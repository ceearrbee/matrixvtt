/**
 * src/map/layers/grid.js - Konva grid layer.
 *
 * Single Konva.Shape whose sceneFunc draws either a square or hex
 * grid via the underlying Canvas2D context. Dependencies:
 * `mapsSignal`, `activeMapIdSignal`, `settingsSignal` - a change to
 * any of those rebuilds the path. Zoom-dependent stroke width is
 * applied inside the sceneFunc, so per-frame resync from
 * `MapRenderer.render()` is enough.
 */
import { effect } from '@preact/signals';
import Konva from 'konva';
import { activeMapIdSignal, mapsSignal, settingsSignal } from '../../state/signals.js';

const SQRT3 = Math.sqrt(3);

export function createGridLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const shape = new Konva.Shape({
    listening: false,
    sceneFunc: (context) => paintGrid(context._context, mr),
  });
  layer.add(shape);

  function sync() { layer.batchDraw(); }

  const dispose = effect(() => {
    activeMapIdSignal.value;
    mapsSignal.value;
    settingsSignal.value;
    sync();
  });

  return { layer, dispose, sync };
}

export function paintGrid(ctx, mr) {
  const map = mr.state?.map;
  if (!map) return;
  const zoom = mr.zoom || 1;
  ctx.strokeStyle = mr._colors?.gridLine || 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1 / zoom;

  const gridType = mr.state?.settings?.grid_type;
  if (gridType === 'hex_pointy' || gridType === 'hex_flat') {
    paintHexGrid(ctx, map, gridType);
    return;
  }
  paintSquareGrid(ctx, map);
}

function paintSquareGrid(ctx, map) {
  ctx.beginPath();
  for (let c = 0; c <= map.width_cells; c++) {
    ctx.moveTo(c * map.cell_px, 0);
    ctx.lineTo(c * map.cell_px, map.height_cells * map.cell_px);
  }
  for (let r = 0; r <= map.height_cells; r++) {
    ctx.moveTo(0, r * map.cell_px);
    ctx.lineTo(map.width_cells * map.cell_px, r * map.cell_px);
  }
  ctx.stroke();
}

function paintHexGrid(ctx, map, orientation) {
  const size = map.cell_px;
  const w = map.width_cells * size;
  const hMap = map.height_cells * size;
  ctx.beginPath();
  if (orientation === 'hex_pointy') {
    const dx = SQRT3 * size;
    const dy = 1.5 * size;
    const cols = Math.ceil(w / dx) + 1;
    const rows = Math.ceil(hMap / dy) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * dx + (r % 2 === 1 ? dx / 2 : 0);
        const cy = r * dy + size;
        hexPath(ctx, cx, cy, size, Math.PI / 6);
      }
    }
  } else {
    const dx = 1.5 * size;
    const dy = SQRT3 * size;
    const cols = Math.ceil(w / dx) + 1;
    const rows = Math.ceil(hMap / dy) + 1;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cx = c * dx + size;
        const cy = r * dy + (c % 2 === 1 ? dy / 2 : 0);
        hexPath(ctx, cx, cy, size, 0);
      }
    }
  }
  ctx.stroke();
}

function hexPath(ctx, cx, cy, size, rot) {
  for (let i = 0; i < 6; i++) {
    const a = rot + (Math.PI / 3) * i;
    const x = cx + size * Math.cos(a);
    const y = cy + size * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
