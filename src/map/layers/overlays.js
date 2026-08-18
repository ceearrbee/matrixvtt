/**
 * src/map/layers/overlays.js - Konva transient overlay layer.
 *
 * Covers the short-lived UI that
 * doesn't fit anywhere else: AoE preview rings, area-selection
 * marquee, measure tool, and map pins.
 *
 * Each of these is driven by mutable class state on `mr`
 * (`mr.drawing`, `mr.areaSelection*`, `mr._measureStart/End`,
 * `mr.state.pins`) rather than a signal, so the layer doesn't
 * subscribe - instead MapRenderer's `render()` calls `sync()` every
 * frame. The drawing code uses a single Konva.Shape + sceneFunc so we
 * keep the legacy Canvas2D helpers unchanged.
 */

import Konva from 'konva';
import { getTokensInCircle, getTokensInCone } from '../../utils/geometry.js';
import { TOKEN_COLORS } from '../../utils/ui-constants.js';
import { measureDistanceCells } from '../../utils/hexGrid.js';
import { activeMapIdSignal } from '../../state/signals.js';

const CELL_FEET = 5;

export function createOverlaysLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const shape = new Konva.Shape({
    listening: false,
    sceneFunc: (context) => {
      const ctx = context._context;
      paintAoEHighlight(ctx, mr);
      paintAreaSelection(ctx, mr);
      paintMeasure(ctx, mr);
      paintPins(ctx, mr);
    },
  });
  layer.add(shape);

  function sync() {
    layer.batchDraw();
  }

  return { layer, sync };
}

export function paintAoEHighlight(ctx, mr) {
  const { isActive, start, current } = mr.drawing || {};
  if (!isActive || !start || !current) return;
  if (mr.activeTool !== 'circle' && mr.activeTool !== 'cone') return;

  const cellPx = mr.state?.map?.cell_px ?? 40;
  const { x: sx, y: sy } = start;
  const { x: ex, y: ey } = current;
  const dx = ex - sx;
  const dy = ey - sy;
  const distFeet = (Math.sqrt(dx * dx + dy * dy) / cellPx) * CELL_FEET;

  const gridType = mr.state?.settings?.grid_type;
  const activeId = activeMapIdSignal.value;
  const activeTokens = new Map(
    [...mr.state.tokens].filter(([, t]) => t?.map_id === activeId),
  );
  const hitIds = mr.activeTool === 'circle'
    ? getTokensInCircle(activeTokens, { x: sx, y: sy }, distFeet, cellPx, CELL_FEET, { gridType })
    : getTokensInCone(activeTokens, { x: sx, y: sy }, Math.atan2(dy, dx), distFeet, 90, cellPx, CELL_FEET, { gridType });

  if (!hitIds.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
  ctx.lineWidth = 2.5 / (mr.zoom || 1);
  for (const id of hitIds) {
    const t = mr.state.tokens.get(id);
    if (!t) continue;
    const tx = t.x !== undefined ? t.x : (t.col + (t.size || 1) / 2) * cellPx;
    const ty = t.y !== undefined ? t.y : (t.row + (t.size || 1) / 2) * cellPx;
    const r = ((t.size || 1) * cellPx) / 2 + 4;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paintAreaSelection(ctx, mr) {
  if (!mr.areaSelectionMode || !mr.areaSelectionStart || !mr.areaSelectionCurrent) return;
  const x = Math.min(mr.areaSelectionStart.x, mr.areaSelectionCurrent.x);
  const y = Math.min(mr.areaSelectionStart.y, mr.areaSelectionCurrent.y);
  const w = Math.abs(mr.areaSelectionCurrent.x - mr.areaSelectionStart.x);
  const h = Math.abs(mr.areaSelectionCurrent.y - mr.areaSelectionStart.y);
  const isReveal = mr.areaSelectionMode === 'reveal';
  ctx.fillStyle = isReveal ? 'rgba(74,158,255,0.2)' : 'rgba(255,107,107,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isReveal ? TOKEN_COLORS.AREA_REVEAL : TOKEN_COLORS.AREA_HIDE;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function paintMeasure(ctx, mr) {
  if (!mr._measureStart || !mr._measureEnd) return;
  const { x: x1, y: y1 } = mr._measureStart;
  const { x: x2, y: y2 } = mr._measureEnd;
  ctx.strokeStyle = '#f7c948';
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  const cellPx = mr.state?.map?.cell_px || 40;
  const cellFeet = mr.state?.map?.cell_feet || CELL_FEET;
  const gridType = mr.state?.settings?.grid_type;
  const cells = measureDistanceCells({ x: x1, y: y1 }, { x: x2, y: y2 }, { gridType, cellPx });
  const feet = Math.round(cells * cellFeet);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${feet} ft`, (x1 + x2) / 2, (y1 + y2) / 2 - 5);
}

function paintPins(ctx, mr) {
  (mr.state?.pins || []).forEach((p) => {
    if (p.gm_only && !mr.state.isGM()) return;
    ctx.fillStyle = p.gm_only ? '#b45050' : '#508cdc';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6 / (mr.zoom || 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = `${10 / (mr.zoom || 1)}px sans-serif`;
    ctx.fillText(p.title, p.x, p.y + 12 / (mr.zoom || 1));
  });
}
