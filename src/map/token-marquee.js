/**
 * Pure geometry for the select marquee: which tokens a swept rectangle
 * caught, and how each marquee mode is tinted. No Konva, no renderer.
 */

import { MARQUEE_MODES, TOKEN_COLORS } from '../utils/ui-constants.js';

const MODE_COLORS = {
  [MARQUEE_MODES.REVEAL]: { fill: 'rgba(74,158,255,0.2)',  stroke: TOKEN_COLORS.AREA_REVEAL },
  [MARQUEE_MODES.HIDE]:   { fill: 'rgba(255,107,107,0.2)', stroke: TOKEN_COLORS.AREA_HIDE },
  [MARQUEE_MODES.SELECT]: { fill: 'rgba(91,184,232,0.15)', stroke: TOKEN_COLORS.AREA_SELECT },
};

export function marqueeColors(mode) {
  return MODE_COLORS[mode] ?? MODE_COLORS[MARQUEE_MODES.REVEAL];
}

function tokenBox(token, cellPx) {
  const size = token.size || 1;
  const half = (size * cellPx) / 2;
  const cx = token.x !== undefined ? token.x : (token.col + size / 2) * cellPx;
  const cy = token.y !== undefined ? token.y : (token.row + size / 2) * cellPx;
  return { x1: cx - half, y1: cy - half, x2: cx + half, y2: cy + half };
}

/**
 * Every token whose footprint overlaps the rectangle, in map order.
 * Overlap rather than containment: a marquee that only clips a large
 * token still means the user was reaching for it.
 */
export function tokensInRect({ tokens, rect, cellPx, isVisible }) {
  const x1 = Math.min(rect.x1, rect.x2);
  const y1 = Math.min(rect.y1, rect.y2);
  const x2 = Math.max(rect.x1, rect.x2);
  const y2 = Math.max(rect.y1, rect.y2);
  const ids = [];
  for (const [id, token] of tokens ?? []) {
    if (!token) continue;
    if (isVisible && !isVisible(token)) continue;
    const box = tokenBox(token, cellPx);
    if (box.x2 <= x1 || box.x1 >= x2 || box.y2 <= y1 || box.y1 >= y2) continue;
    ids.push(id);
  }
  return ids;
}
