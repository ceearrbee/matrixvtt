/**
 * src/map/layers/fog.js - Konva fog + vision mask layer.
 *
 * Two shapes stacked:
 *
 *   1. Fog-of-war mask - a single Konva.Shape that fills the map rect
 *      and cuts holes for revealed cells via an evenodd sub-path (the
 *      same trick the Canvas2D implementation used). Layer opacity
 *      differentiates GM (~0.45, see-through) from players (1.0).
 *   2. Vision mask - non-GM-only darkness plus an optional darkvision
 *      annulus, both clipped by sight-blocking walls via shadow quads.
 *      This replaces `src/map/render/vision.js`.
 *
 * Both shapes use `sceneFunc` + the underlying Canvas2D context so the
 * path logic from the legacy renderer translates verbatim.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { tablePhaseSignal } from '../../state/ui-signals.js';
import {
  fogSignal, tokensSignal, wallsSignal, settingsSignal, activeMapIdSignal, mapsSignal,
  lightsSignal,
} from '../../state/signals.js';
import { FOG_MODES } from '../../utils/ui-constants.js';
import { UI_MODES } from '../../utils/constants.js';
import { lightsAsVisionOrigins } from '../vision-light.js';
import { parseRevealedCells, createRevealedCellsCache } from '../fog-cells.js';

const SHADOW_EXTEND = 10000;
const DARKNESS_FILL = 'rgba(0, 0, 0, 0.85)';
const DARKVISION_TINT = 'rgba(70, 110, 160, 0.45)';

export function createFogLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const getRevealedCells = createRevealedCellsCache();
  const fogShape = new Konva.Shape({
    name: 'fog',
    listening: false,
    sceneFunc: (context) => paintFog(context._context, mr, getRevealedCells),
  });
  layer.add(fogShape);

  const visionShape = new Konva.Shape({
    name: 'vision',
    listening: false,
    sceneFunc: (context) => paintVision(context._context, mr),
  });
  layer.add(visionShape);

  function sync() {
    const fog = mr.state?.fog ?? { mode: FOG_MODES.HIDDEN, revealed: [] };
    layer.visible(fog.mode === FOG_MODES.HIDDEN);
    layer.batchDraw();
  }

  sync();

  // React to any signal that influences fog / vision output.
  const dispose = effect(() => {
    fogSignal.value;
    tokensSignal.value;
    wallsSignal.value;
    lightsSignal.value;
    settingsSignal.value;
    activeMapIdSignal.value;
    mapsSignal.value;
    tablePhaseSignal.value; // alpha changes with phase - repaint
    sync();
  });

  return { layer, dispose, sync };
}

export function paintFog(ctx, mr, getCells = parseRevealedCells) {
  const map = mr.state?.map;
  if (!map) return;
  const fog = mr.state?.fog ?? { mode: FOG_MODES.HIDDEN, revealed: [] };
  if (fog.mode !== FOG_MODES.HIDDEN) return;

  const { width_cells: wc, height_cells: hc, cell_px: px } = map;
  ctx.beginPath();
  ctx.rect(0, 0, wc * px, hc * px);
  for (const [c, r] of getCells(fog.revealed)) {
    ctx.rect(c * px, r * px, px, px);
  }
  // Narrative mode drops GM fog alpha from 0.45 → 0.30 so the overlay
  // reads as "atmospheric" rather than "oppressive" on dark maps when
  // the table is in conversation. Player fog stays fully opaque - it's
  // a hide-vs-reveal contract, not a stylistic dial.
  const gmAlpha = tablePhaseSignal.value === UI_MODES.NARRATIVE ? 0.3 : 0.45;
  ctx.fillStyle = mr.state?.isGM?.() ? `rgba(0, 0, 0, ${gmAlpha})` : 'rgba(0, 0, 0, 1)';
  ctx.fill('evenodd');
}

export function paintVision(ctx, mr) {
  const map = mr.state?.map;
  if (!map) return;
  if (mr.state?.isGM?.()) return;

  const tokenOrigins = collectVisionOrigins(mr);
  const lightOrigins = lightsAsVisionOrigins(mr.state?.lights);
  const origins = [...tokenOrigins, ...lightOrigins];
  if (origins.length === 0) return;

  const walls = collectBlockingWalls(mr);
  const { width_cells: wc, height_cells: hc, cell_px: px } = map;
  const w = wc * px;
  const h = hc * px;

  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  for (const o of origins) {
    const outer = Math.max(o.bright, o.dark);
    carveVisionRegion(ctx, o.x, o.y, outer, walls, w, h);
  }
  ctx.fillStyle = DARKNESS_FILL;
  ctx.fill('evenodd');

  const hasDarkvision = origins.some((o) => o.dark > o.bright);
  if (!hasDarkvision) return;

  ctx.beginPath();
  for (const o of origins) {
    if (o.dark <= o.bright) continue;
    carveAnnulus(ctx, o.x, o.y, o.bright, o.dark, walls, w, h);
  }
  ctx.fillStyle = DARKVISION_TINT;
  ctx.fill('evenodd');
}

function collectVisionOrigins(mr) {
  const out = [];
  const cellPx = mr.state?.map?.cell_px ?? 40;
  const myId = mr.state?.widgetManager?.userId ?? null;
  const unitsPerCell = mr.state?.settings?.systemConfig?.movement?.unitsPerCell || 5;
  for (const t of mr.state.tokens.values()) {
    const bright = typeof t.vision_radius === 'number' ? t.vision_radius : 0;
    const dark = typeof t.darkvision_radius === 'number' ? t.darkvision_radius : 0;
    if (bright <= 0 && dark <= 0) continue;
    if (t.owner_id && t.owner_id !== myId) continue;
    const tx = t.x !== undefined ? t.x : (t.col + (t.size || 1) / 2) * cellPx;
    const ty = t.y !== undefined ? t.y : (t.row + (t.size || 1) / 2) * cellPx;
    out.push({
      x: tx, y: ty,
      bright: (bright / unitsPerCell) * cellPx,
      dark: (dark / unitsPerCell) * cellPx,
    });
  }
  return out;
}

function collectBlockingWalls(mr) {
  const walls = mr.state?.walls;
  if (!walls) return [];
  const out = [];
  for (const w of walls.values()) {
    if (w?.blocks_sight === false) continue;
    if (!w?.p1 || !w?.p2) continue;
    out.push(w);
  }
  return out;
}

function carveVisionRegion(ctx, ox, oy, radius, walls, mapW, mapH) {
  if (radius <= 0) return;
  ctx.moveTo(ox + radius, oy);
  ctx.arc(ox, oy, radius, 0, Math.PI * 2);
  for (const wall of walls) {
    drawShadowQuad(ctx, ox, oy, wall.p1, wall.p2, Math.max(mapW, mapH) + SHADOW_EXTEND);
  }
}

function carveAnnulus(ctx, ox, oy, inner, outer, walls, mapW, mapH) {
  ctx.moveTo(ox + outer, oy);
  ctx.arc(ox, oy, outer, 0, Math.PI * 2);
  if (inner > 0) {
    ctx.moveTo(ox + inner, oy);
    ctx.arc(ox, oy, inner, 0, Math.PI * 2, true);
  }
  for (const wall of walls) {
    drawShadowQuad(ctx, ox, oy, wall.p1, wall.p2, Math.max(mapW, mapH) + SHADOW_EXTEND);
  }
}

function drawShadowQuad(ctx, ox, oy, p1, p2, extend) {
  const d1x = p1.x - ox, d1y = p1.y - oy;
  const d2x = p2.x - ox, d2y = p2.y - oy;
  const len1 = Math.hypot(d1x, d1y) || 1;
  const len2 = Math.hypot(d2x, d2y) || 1;
  const f1x = p1.x + (d1x / len1) * extend;
  const f1y = p1.y + (d1y / len1) * extend;
  const f2x = p2.x + (d2x / len2) * extend;
  const f2y = p2.y + (d2y / len2) * extend;
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(f1x, f1y);
  ctx.lineTo(f2x, f2y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
}
