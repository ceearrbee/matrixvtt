/**
 * src/map/layers/tokens.js - Konva token layer.
 *
 * Holds one
 * `Konva.Group` per token and keeps it in sync with `tokensSignal`
 * via an `effect()`. Rendering only - input travels through the
 * map input handlers.
 *
 * Each Group's contents mirror the legacy Canvas2D output:
 *   · selection ring + active-combatant pulse
 *   · body (circle filled with colour, or circular image)
 *   · ruleset `token.overlays[]` (resource bars / pips / badges) via a
 *     custom Konva.Shape that delegates to the existing Canvas2D drawer
 *     so we keep the single source of truth for that logic
 *   · legacy HP bar fallback when no ruleset overlays are declared
 *   · facing arrow
 *   · name label
 *   · condition ring
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { tokensSignal, activeMapIdSignal, pinsSignal } from '../../state/signals.js';
import { COND_ICONS } from '../../utils/conditions.js';
import { visibleTokensForViewer } from '../../utils/tokenLayer.js';
import { HP_COLORS } from '../../utils/ui-constants.js';
import { ENTITY_TYPES } from '../../utils/constants.js';
import { cellToPixel } from '../../utils/grid-coords.js';
import { placeMapLabels } from '../place-map-labels.js';
import { getOrLoadImage } from './image-cache.js';
import { renderTokenOverlays } from '../token-overlays-draw.js';
import { enableTokenDrag } from '../input/token-drag.js';
import { createRevealedSetCache } from '../fog-cells.js';

const PULSE_PERIOD_MS = 1200;
const ARROW_OVERHANG_PX = 5;

export function getActiveCombatantRingAlpha(t) {
  const time = t ?? performance.now();
  return 0.7 + 0.3 * Math.cos((2 * Math.PI * time) / PULSE_PERIOD_MS);
}

export function panToToken(mr, tokenId) {
  const t = mr.state.tokens.get(tokenId);
  if (!t) return;
  const px = mr.state.map?.cell_px || 40;
  const tx = t.x !== undefined ? t.x : (t.col + 0.5) * px;
  const ty = t.y !== undefined ? t.y : (t.row + 0.5) * px;
  const canvasW = mr.stage?.width() ?? mr.canvas?.clientWidth ?? mr.canvas?.width ?? 800;
  const canvasH = mr.stage?.height() ?? mr.canvas?.clientHeight ?? mr.canvas?.height ?? 600;
  mr.panX = canvasW / 2 - tx * mr.zoom;
  mr.panY = canvasH / 2 - ty * mr.zoom;
  mr.render();
}

export function facingArrowEnd({ x, y, radius, facing }) {
  if (facing === null || facing === undefined) return null;
  const reach = radius + ARROW_OVERHANG_PX;
  return {
    x: x + Math.cos(facing) * reach,
    y: y + Math.sin(facing) * reach,
  };
}

export function createTokensLayer(stage, mr) {
  const layer = new Konva.Layer();
  stage.add(layer);

  const groups = new Map();
  // Cache the last (id, x, y, size, name) signature so the O(N²)
  // collision pass skips when nothing affecting label placement has
  // changed. HP-only updates, condition toggles, drag-in-progress
  // (which sets the same x/y after settling) re-render the token
  // group but don't move the label.
  let _lastLabelSig = '';
  // sync() runs on every render, including each dragmove frame, so the
  // revealed-cell Set is cached by array identity instead of rebuilt.
  const getRevealedSet = createRevealedSetCache();

  function keepId(id, token, viewer, fogRevealed) {
    if (viewer.isGM) return true;
    if (token.visible === false) return false;
    // Call as a method so `this` binds to mr.state - the StateManager
    // method forwards to reader.isTokenVisibleToPlayer(this, token, ...)
    // and an unbound call hits a `sm is undefined` crash inside isGM.
    const sm = mr.state;
    if (typeof sm?.isTokenVisibleToPlayer === 'function'
      && !sm.isTokenVisibleToPlayer(token, fogRevealed)) return false;
    return true;
  }

  function sync() {
    const tokens = tokensSignal.value;
    const activeId = activeMapIdSignal.value;
    const isGM = !!mr.state?.isGM?.();
    const viewer = { isGM };
    const fogRevealed = getRevealedSet(mr.state?.fog?.revealed);
    const visible = visibleTokensForViewer(tokens, viewer);
    const keep = new Set();

    for (const token of visible) {
      const id = token.id;
      if (token.map_id !== activeId) continue;
      if (!keepId(id, token, viewer, fogRevealed)) continue;
      keep.add(id);
      let group = groups.get(id);
      if (!group) {
        group = buildGroup();
        groups.set(id, group);
        layer.add(group);
      }
      updateGroup(group, token, id, mr);
      enableTokenDrag(group, mr, id);
    }
    for (const [id, group] of groups) {
      if (!keep.has(id)) {
        group.destroy();
        groups.delete(id);
      }
    }
    // Second pass: place name labels above their markers, stacking upward
    // when they would overlap. Pin labels (separate layer) are deconflicted
    // in the same pass via placeAllLabels -> placeMapLabels. Dirty-check on
    // a (token id,x,y,size,name) + (pin id,col,row,label) + zoom signature
    // so the O(N²) layout skips when nothing label-affecting changed - HP
    // nudges, condition toggles, etc. all bypass. Zoom is included because
    // label font size (and thus measured width) scales with it.
    const pinGroups = mr._pinsLayer?.groups;
    let sig = `z${mr.zoom || 1};`;
    for (const token of visible) {
      sig += `${token.id}|${token.x}|${token.y}|${token.size}|${token.name || ''};`;
    }
    for (const [pid, p] of (pinsSignal.value || new Map())) {
      sig += `p${pid}|${p.col}|${p.row}|${p.label || ''};`;
    }
    if (sig !== _lastLabelSig) {
      _lastLabelSig = sig;
      placeAllLabels(groups, pinGroups);
    }
    layer.batchDraw();
  }

  const dispose = effect(() => {
    // read the signals so the effect subscribes - pins included so a pin
    // add/move/relabel re-runs the combined label placement.
    tokensSignal.value;
    activeMapIdSignal.value;
    pinsSignal.value;
    sync();
  });

  return { layer, groups, dispose, sync };
}

function tokenCentre(t, map, gridType) {
  const cellPx = map?.cell_px || 40;
  const size = t.size || 1;
  if (size === 1) {
    const p = cellToPixel(map, t.col, t.row, gridType);
    return { x: p.x, y: p.y, cellPx, size };
  }
  return {
    x: (t.col + size / 2) * cellPx,
    y: (t.row + size / 2) * cellPx,
    cellPx,
    size,
  };
}

function tokenRadius(size, cellPx) {
  return (size * cellPx) / 2 - 2;
}

const AURA_SLOTS = 4;
const AURA_DEFAULT_OPACITY = 0.18;

function buildGroup() {
  const group = new Konva.Group();
  // Auras render behind everything else (selection ring, body, etc.),
  // so add the group FIRST. Pre-allocate AURA_SLOTS circles per the
  // same allocation-free pattern used for conditions.
  const auras = new Konva.Group({ name: 'auras', listening: false });
  for (let i = 0; i < AURA_SLOTS; i++) {
    auras.add(new Konva.Circle({
      name: `aura-${i}`,
      visible: false, listening: false,
      strokeEnabled: false,
    }));
  }
  group.add(auras);
  // Named children so updateGroup can find+mutate each piece in place.
  group.add(new Konva.Circle({ name: 'selRing', visible: false, listening: false }));
  group.add(new Konva.Circle({ name: 'turnRing', visible: false, listening: false }));
  group.add(new Konva.Circle({ name: 'body' }));
  group.add(new Konva.Image({ name: 'sprite', visible: false, listening: false, image: undefined }));
  group.add(new Konva.Text({ name: 'initials', listening: false, align: 'center', verticalAlign: 'middle', fill: 'white' }));
  group.add(new Konva.Rect({ name: 'hpBg', visible: false, listening: false, fill: 'rgba(0,0,0,0.5)' }));
  group.add(new Konva.Rect({ name: 'hpFg', visible: false, listening: false }));
  group.add(new Konva.Text({ name: 'deathX', visible: false, listening: false, text: '✕', fill: 'rgba(226,75,74,0.8)', align: 'center', verticalAlign: 'middle' }));
  group.add(new Konva.Shape({
    name: 'rulesetOverlays',
    listening: false,
    sceneFunc: (context, shape) => {
      const data = shape.getAttr('data');
      if (!data) return;
      renderTokenOverlays(context._context, data.token, data.overlays, data.x, data.y, data.radius);
    },
  }));
  group.add(new Konva.Line({ name: 'facing', visible: false, listening: false, stroke: HP_COLORS.WARN, lineCap: 'round' }));
  // wrap: 'none' so long names ("Orc War Boss", "Lieutenant Orc") stay on a
  // single line instead of breaking into stacks that collide with adjacent
  // tokens' labels. Single-line labels may still overlap horizontally on
  // crowded maps, but each remains readable as one piece.
  // `ellipsis: true` (with wrap:'none' + a set width) truncates an over-long
  // single name to its box with "…" instead of bleeding past it into the next
  // token - e.g. "Lieutenant Orc" → "Lieuten…" on a phone.
  group.add(new Konva.Text({ name: 'name', listening: false, fill: 'white', align: 'center', wrap: 'none', ellipsis: true, shadowColor: 'black', shadowBlur: 4 }));

  // Pre-allocate 6 condition slots (matches the visible cap in
  // updateGroup's conditions ring). Each slot is a Circle (background
  // dot) + Text (icon glyph). On each render we mutate position /
  // visibility / text instead of destroyChildren-ing and reallocating
  // - 12 fewer Konva node allocations per render per token, which
  // was the headline `drag-perf` finding from the production audit.
  const conditions = new Konva.Group({ name: 'conditions', listening: false });
  for (let i = 0; i < 6; i++) {
    conditions.add(new Konva.Circle({
      name: `condDot-${i}`, visible: false, listening: false, fill: '#1a1a2e',
    }));
    conditions.add(new Konva.Text({
      name: `condText-${i}`, visible: false, listening: false,
      align: 'center', verticalAlign: 'middle',
      fontFamily: 'sans-serif', fill: '#ff9944',
    }));
  }
  group.add(conditions);
  return group;
}

function findChild(group, name) {
  return group.findOne(`.${name}`);
}

/**
 * Resolve a token's aura list, supporting:
 *   - new generic shape: token.auras = [{ radius, color?, opacity? }, …]
 *   - legacy single-aura shape: token.aura_radius + token.aura_color
 * Returns [] for "no aura." Skips entries with non-positive radius.
 */
function resolveAuras(token) {
  if (Array.isArray(token?.auras) && token.auras.length > 0) {
    return token.auras
      .filter((a) => Number(a?.radius) > 0)
      .slice(0, AURA_SLOTS);
  }
  const legacyRadius = Number(token?.aura_radius);
  if (legacyRadius > 0) {
    return [{ radius: legacyRadius, color: token.aura_color }];
  }
  return [];
}

function syncAuras(group, token, cellPx) {
  const auras = group.findOne('.auras');
  if (!auras) return;
  const items = resolveAuras(token);
  const children = auras.getChildren();
  for (let i = 0; i < children.length; i++) {
    const circle = children[i];
    const a = items[i];
    if (!a) {
      circle.visible(false);
      continue;
    }
    const opacity = Number.isFinite(Number(a.opacity)) ? Number(a.opacity) : AURA_DEFAULT_OPACITY;
    circle.visible(true);
    circle.position({ x: 0, y: 0 });
    circle.radius(Number(a.radius) * cellPx);
    circle.fill(a.color || '#5BB8E8');
    circle.opacity(Math.max(0, Math.min(1, opacity)));
  }
}

function updateGroup(group, token, id, mr) {
  const map = mr.state?.map;
  const gridType = mr.state?.settings?.grid_type;
  const { x: wx, y: wy, cellPx, size } = tokenCentre(token, map, gridType);
  const radius = tokenRadius(size, cellPx);
  const zoom = mr.zoom || 1;

  if (!group.isDragging()) {
    group.position({ x: wx, y: wy });
  }
  const x = 0;
  const y = 0;

  group.opacity(token.visible === false ? 0.4 : 1);

  syncAuras(group, token, cellPx);

  const sel = findChild(group, 'selRing');
  const isSelected = id === mr.selectedToken;
  sel.visible(isSelected);
  if (isSelected) {
    sel.position({ x, y });
    sel.radius(radius + 4);
    sel.stroke(HP_COLORS.WARN);
    sel.strokeWidth(3 / zoom);
    sel.fillEnabled(false);
  }

  const initiative = mr.state?.initiative;
  const isTurn = !!(initiative?.active
    && initiative.order?.[initiative.current_index]?.token_id === id);
  const turn = findChild(group, 'turnRing');
  turn.visible(isTurn);
  if (isTurn) {
    turn.position({ x, y });
    turn.radius(radius + 8);
    turn.stroke(HP_COLORS.WARN);
    turn.strokeWidth(3 / zoom);
    turn.opacity(getActiveCombatantRingAlpha());
    turn.fillEnabled(false);
  }

  // Body: sprite when image loaded, else filled circle with initials.
  const body = findChild(group, 'body');
  const sprite = findChild(group, 'sprite');
  const initials = findChild(group, 'initials');
  const img = token.image_url ? getOrLoadImage(mr, token.image_url, `t-${id}`) : null;
  if (img?.complete && img.naturalWidth > 0) {
    sprite.visible(true);
    sprite.image(img);
    sprite.position({ x: x - radius, y: y - radius });
    sprite.size({ width: radius * 2, height: radius * 2 });
    // Round clip via sceneFunc path unavailable on Konva.Image directly;
    // apply a circular mask by setting a clip on the Group's subregion
    // via cornerRadius trick: Konva.Image doesn't support cornerRadius
    // at arbitrary radii, so use a cached Konva.Group would work but
    // that complicates diffing. Workaround: fill circle behind the
    // image so edges of the square sprite never poke past the token.
    body.visible(true);
    body.position({ x, y });
    body.radius(radius);
    body.fill(token.color || '#666');
    body.stroke(undefined);
    initials.visible(false);
  } else {
    sprite.visible(false);
    body.visible(true);
    body.position({ x, y });
    body.radius(radius);
    body.fill(token.color || '#666');
    initials.visible(true);
    const label = (token.name || '?').substring(0, 2).toUpperCase();
    initials.text(label);
    const fontPx = radius * 0.8;
    initials.fontSize(fontPx);
    initials.fontFamily('sans-serif');
    // Konva.Text positions by top-left; centre it on (x, y) manually
    // because width/height need to be set for align/verticalAlign to apply.
    initials.width(radius * 2);
    initials.height(radius * 2);
    initials.position({ x: x - radius, y: y - radius });
  }

  // Ruleset overlays vs legacy HP bar - mutually exclusive, matches the
  // old drawRulesetOverlays branch.
  const overlaysCfg = mr.state?.settings?.systemConfig?.token?.overlays;
  const isOwner = token.owner_user_id === mr.state?.widgetManager?.userId;
  const isGM = !!mr.state?.isGM?.();
  const showHP = isGM || isOwner || (token.type !== ENTITY_TYPES.NPC && token.show_hp !== false);
  const rulesetOverlays = findChild(group, 'rulesetOverlays');
  const hpBg = findChild(group, 'hpBg');
  const hpFg = findChild(group, 'hpFg');
  const deathX = findChild(group, 'deathX');

  if (Array.isArray(overlaysCfg) && overlaysCfg.length > 0 && showHP) {
    rulesetOverlays.visible(true);
    rulesetOverlays.setAttr('data', {
      token,
      overlays: overlaysCfg.map((o) => ({ ...o, _zoom: zoom })),
      x,
      y,
      radius,
    });
    hpBg.visible(false);
    hpFg.visible(false);
    deathX.visible(false);
  } else {
    rulesetOverlays.visible(false);
    if (showHP && token.hp_max > 0) {
      const pct = Math.max(0, Math.min(1, token.hp_current / token.hp_max));
      const palette = mr._colors || {};
      const color = pct > 0.5
        ? (palette.hpGood || HP_COLORS.GOOD)
        : pct > 0.25
          ? (palette.hpWarn || HP_COLORS.WARN)
          : (palette.hpDanger || HP_COLORS.DANGER);
      // 6 px reads at default zoom; 4 px (the old size) was almost
      // invisible in the screenshot. The label below the bar shifts
      // by the same 2 px via the existing `+ 10` offset.
      hpBg.visible(true);
      hpBg.position({ x: x - radius, y: y + radius + 4 });
      hpBg.size({ width: radius * 2, height: 6 });
      hpFg.visible(true);
      hpFg.position({ x: x - radius, y: y + radius + 4 });
      hpFg.size({ width: radius * 2 * pct, height: 6 });
      hpFg.fill(color);
      if (token.hp_current <= 0) {
        deathX.visible(true);
        deathX.text('✕');
        deathX.fontSize(radius);
        deathX.fontFamily('sans-serif');
        deathX.fontStyle('bold');
        deathX.width(radius * 2);
        deathX.height(radius * 2);
        deathX.position({ x: x - radius, y: y - radius });
      } else {
        deathX.visible(false);
      }
    } else {
      hpBg.visible(false);
      hpFg.visible(false);
      deathX.visible(false);
    }
  }

  // Facing arrow.
  const facing = findChild(group, 'facing');
  const end = facingArrowEnd({ x, y, radius, facing: token.facing });
  if (end) {
    facing.visible(true);
    facing.points([x, y, end.x, end.y]);
    facing.strokeWidth(2 / zoom);
  } else {
    facing.visible(false);
  }

  // Name label: set only the text/font here. Width + position are owned
  // by placeTokenLabels (the post-position pass), so this per-token sync -
  // which re-runs every frame while the current-turn ring animates - does
  // NOT reset the label and fight the stacking placement.
  const name = findChild(group, 'name');
  name.text(token.name || '');
  name.fontSize(Math.max(10, 12 / zoom));
  name.fontFamily('sans-serif');
  name.fontStyle(mr._colors?.tokenLabelWeight || 'normal');

  // Conditions around perimeter - mutate the 6 pre-allocated
  // (Circle, Text) pairs from buildGroup; no destroyChildren.
  const conds = [
    ...(token.conditions || []),
    ...(token.exhaustion_level > 0 ? [`E${token.exhaustion_level}`] : []),
  ];
  const br = 6 / zoom;
  for (let i = 0; i < 6; i++) {
    const dot = findChild(group, `condDot-${i}`);
    const txt = findChild(group, `condText-${i}`);
    const c = conds[i];
    if (c == null) {
      dot.visible(false);
      txt.visible(false);
      continue;
    }
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    const cx = x + (radius + 2) * Math.cos(angle);
    const cy = y + (radius + 2) * Math.sin(angle);
    dot.visible(true);
    dot.position({ x: cx, y: cy });
    dot.radius(br);
    txt.visible(true);
    txt.position({ x: cx - br, y: cy - br });
    txt.width(br * 2);
    txt.height(br * 2);
    txt.text(COND_ICONS[c] || c[0].toUpperCase());
    txt.fontSize(br * 1.2);
  }
}

/**
 * After all groups are positioned by their per-token sync pass, place each
 * token's name label just ABOVE its token, stacking labels upward in discrete
 * rows whenever two would overlap (crowded combat clusters). Delegates the
 * placement math to the pure, unit-tested `layoutTokenLabels` helper.
 *
 * Groups sit at the token's world centre with children in group-local coords
 * (token centre = local 0,0). The helper works in world space, so each anchor
 * is converted back to local before being applied to the `name` node. Label
 * width is the *measured* text width capped at the box width (radius*4) - the
 * same cap the `ellipsis` trim uses - so collision boxes match what's drawn.
 */
function placeAllLabels(tokenGroups, pinGroups) {
  /** @type {import('../place-map-labels.js').LabelEntry[]} */
  const entries = [];

  // Token labels: group sits at the token's world centre, the `name` node
  // is in group-local coords, so the world anchor is converted back to
  // local on apply. Width is the measured text capped at 4× radius (the
  // `ellipsis` trim width) so the collision box matches what's drawn.
  for (const [id, group] of tokenGroups) {
    const name = group.findOne('.name');
    if (!name || !name.text()) continue;
    const body = group.findOne('.body');
    const radius = body?.radius?.() ?? 20;
    const { x: wx, y: wy } = group.position();
    const w = Math.min(name.getTextWidth(), radius * 4);
    name.width(w);
    entries.push({
      id: `tok:${id}`,
      box: { x: wx - radius, y: wy - radius, w: radius * 2, h: radius * 2 },
      labelWidth: w,
      labelHeight: name.fontSize?.() ?? 12,
      apply: (a) => name.position({ x: a.x - wx, y: a.y - wy }),
    });
  }

  // Pin labels: pin groups sit at 0,0 with children drawn in world coords,
  // so the anchor is applied directly. Cap at the pin label's 120px box.
  for (const [id, group] of (pinGroups || new Map())) {
    const label = group.findOne('.label');
    const marker = group.findOne('.marker');
    if (!label || !label.text() || !marker) continue;
    const cx = marker.x();
    const cy = marker.y();
    const r = marker.radius?.() ?? 8;
    const w = Math.min(label.getTextWidth(), 120);
    label.width(w);
    entries.push({
      id: `pin:${id}`,
      box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 },
      labelWidth: w,
      labelHeight: label.fontSize?.() ?? 12,
      apply: (a) => label.position({ x: a.x, y: a.y }),
    });
  }

  placeMapLabels(entries);
}
