/**
 * The marquee rectangle: arming it, tracking it, and deciding what its
 * release means. Reveal and hide sweep fog; select gathers the tokens
 * the rectangle covered. The rectangle itself is painted by
 * `src/map/layers/overlays.js` and the geometry lives in
 * `src/map/token-marquee.js`.
 */

import { MARQUEE_MODES } from '../../utils/ui-constants.js';
import { tokensInRect } from '../token-marquee.js';
import { completeFogArea } from './fog.js';

// A press that barely moved is a click, not a drag, so the marquee
// hands it back rather than replacing the selection with nothing.
const DRAG_THRESHOLD_PX = 4;

/**
 * Enter marquee mode. The next mousedown on the map starts the
 * selection rectangle; mousemove updates it; mouseup commits via
 * `completeAreaSelection`. Esc cancels (handled in the keyboard
 * handler at `src/map/input/keyboard.js`).
 */
export function startAreaSelection(mr, mode) {
  if (!Object.values(MARQUEE_MODES).includes(mode)) return;
  if (mode !== MARQUEE_MODES.SELECT && !mr.state.isGM?.()) return;
  mr.areaSelectionMode = mode;
  mr.areaSelectionStart = null;
  mr.areaSelectionCurrent = null;
  const c = mr.stage?.container?.() ?? mr.canvas;
  if (c?.style) c.style.cursor = 'crosshair';
  if (mode === MARQUEE_MODES.REVEAL) mr._toast?.('Drag to reveal area', 'info');
  else if (mode === MARQUEE_MODES.HIDE) mr._toast?.('Drag to hide area', 'info');
  mr.render?.();
}

/**
 * Arm select mode already mid-drag, for the pointer-tool gesture that
 * starts one without a menu: no cursor change, no toast, no render.
 */
export function beginSelectMarquee(mr, x, y) {
  mr.areaSelectionMode = MARQUEE_MODES.SELECT;
  mr.areaSelectionStart = { x, y };
  mr.areaSelectionCurrent = { x, y };
}

function commitSelection(mr, rect) {
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);
  if (width < DRAG_THRESHOLD_PX && height < DRAG_THRESHOLD_PX) return;
  const isGM = mr.state.isGM?.() === true;
  mr.setSelectedTokens?.(tokensInRect({
    tokens: mr.state.tokens,
    rect,
    cellPx: mr.state.map?.cell_px || 40,
    isVisible: isGM ? null : (t) => mr.state.isTokenVisibleToPlayer?.(t) !== false,
  }));
  mr._suppressNextClick = true;
}

export async function completeAreaSelection(mr) {
  if (!mr.areaSelectionMode || !mr.areaSelectionStart || !mr.areaSelectionCurrent) return;
  const rect = {
    x1: mr.areaSelectionStart.x, y1: mr.areaSelectionStart.y,
    x2: mr.areaSelectionCurrent.x, y2: mr.areaSelectionCurrent.y,
  };
  const mode = mr.areaSelectionMode;
  mr.areaSelectionMode = mr.areaSelectionStart = mr.areaSelectionCurrent = null;

  if (mode === MARQUEE_MODES.SELECT) {
    commitSelection(mr, rect);
    mr.render?.();
    return;
  }
  await completeFogArea(mr, rect, mode === MARQUEE_MODES.REVEAL);
}
