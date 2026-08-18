/**
 * Fog-of-war reveal/hide ops triggered by marquee area selection or cell click.
 */

import { emitVttError as emitError } from '../../utils/errorHandling.js';

/**
 * Enter marquee mode. The next mousedown on the map starts the
 * selection rectangle; mousemove updates it; mouseup commits via
 * `completeAreaSelection`. Esc cancels (handled in the keyboard
 * handler at `src/map/input/keyboard.js`).
 */
export function startAreaSelection(mr, mode) {
  if (!mr.state.isGM?.()) return;
  if (mode !== 'reveal' && mode !== 'hide') return;
  mr.areaSelectionMode = mode;
  mr.areaSelectionStart = null;
  mr.areaSelectionCurrent = null;
  const c = mr.stage?.container?.() ?? mr.canvas;
  if (c?.style) c.style.cursor = 'crosshair';
  mr._toast?.(mode === 'reveal' ? 'Drag to reveal area' : 'Drag to hide area', 'info');
  mr.render?.();
}

async function commitFog(mr, revealed) {
  try {
    await mr.state.updateFog({ ...mr.state.fog, revealed: Array.from(revealed) });
  } catch (e) {
    emitError('Failed to update fog', e);
  }
  mr.render();
}

export async function completeAreaSelection(mr) {
  if (!mr.areaSelectionMode || !mr.areaSelectionStart || !mr.areaSelectionCurrent) return;
  const map = mr.state.map;
  if (!map) return;

  const x1 = Math.min(mr.areaSelectionStart.x, mr.areaSelectionCurrent.x);
  const y1 = Math.min(mr.areaSelectionStart.y, mr.areaSelectionCurrent.y);
  const x2 = Math.max(mr.areaSelectionStart.x, mr.areaSelectionCurrent.x);
  const y2 = Math.max(mr.areaSelectionStart.y, mr.areaSelectionCurrent.y);
  // Clamp the drag rect into map cell space. A drag that starts past
  // the panned origin produces negative world coords and the loop
  // below would otherwise add fog cell keys like "-1,5" to the set -
  // legal storage, but a data quirk that confuses downstream readers.
  const maxCol = Math.max(0, (map.width_cells ?? 1) - 1);
  const maxRow = Math.max(0, (map.height_cells ?? 1) - 1);
  const clampCol = (n) => Math.min(maxCol, Math.max(0, Math.floor(n / map.cell_px)));
  const clampRow = (n) => Math.min(maxRow, Math.max(0, Math.floor(n / map.cell_px)));
  const col1 = clampCol(x1), col2 = clampCol(x2);
  const row1 = clampRow(y1), row2 = clampRow(y2);

  const revealed = new Set(mr.state.fog.revealed || []);
  const reveal = mr.areaSelectionMode === 'reveal';
  for (let r = row1; r <= row2; r++) {
    for (let c = col1; c <= col2; c++) {
      if (reveal) revealed.add(`${c},${r}`);
      else revealed.delete(`${c},${r}`);
    }
  }

  mr.areaSelectionMode = mr.areaSelectionStart = mr.areaSelectionCurrent = null;
  await commitFog(mr, revealed);
}

export async function toggleSingleFogCell(mr, col, row) {
  if (!mr.state.map) return;
  const key = `${col},${row}`;
  const revealed = new Set(mr.state.fog.revealed || []);
  if (revealed.has(key)) revealed.delete(key);
  else revealed.add(key);
  await commitFog(mr, revealed);
}
