/**
 * src/map/hit-test.js - pure geometry helpers for tools.
 *
 * Extracted from `Interaction.js` so the tools module (and tests)
 * can call them without a MapRenderer. World-space coordinates only.
 */
import { ptSegDistSq } from '../utils/geometry.js';
import { cellToPixel } from '../utils/grid-coords.js';

export function tokenAt({ tokens, map, gridType, x, y, getRadius }) {
  const px = map?.cell_px || 40;
  for (const [id, t] of tokens) {
    const size = t.size || 1;
    const { x: tx, y: ty } = size === 1
      ? cellToPixel(map, t.col, t.row, gridType)
      : { x: (t.col + size / 2) * px, y: (t.row + size / 2) * px };
    const radius = getRadius(t, px);
    if (Math.hypot(x - tx, y - ty) <= radius) return { ...t, id };
  }
  return null;
}

export function wallAt({ walls, x, y, threshold = 8 }) {
  if (!walls) return null;
  const t2 = threshold * threshold;
  for (const w of walls.values()) {
    if (!w?.p1 || !w?.p2) continue;
    if (ptSegDistSq(x, y, w.p1.x, w.p1.y, w.p2.x, w.p2.y) < t2) return w;
  }
  return null;
}

export function templateAt({ templates, x, y, cellPx }) {
  if (!templates) return null;
  for (const t of templates.values()) {
    const ox = (t.origin?.col ?? 0) * cellPx;
    const oy = (t.origin?.row ?? 0) * cellPx;
    if (t.shape === 'circle' || t.shape === 'square') {
      const r = (t.radius || 1) * cellPx;
      const dx = x - ox, dy = y - oy;
      if (t.shape === 'circle' ? dx * dx + dy * dy <= r * r : Math.abs(dx) <= r && Math.abs(dy) <= r) return t;
    }
  }
  return null;
}

export function pinAt({ pins, x, y, cellPx, isGM = false, threshold = 12 }) {
  if (!pins) return null;
  const t2 = threshold * threshold;
  for (const [id, p] of pins) {
    if (!p) continue;
    if (!isGM && p.gm_only) continue;
    const cx = (p.col + 0.5) * cellPx;
    const cy = (p.row + 0.5) * cellPx;
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= t2) return { ...p, id };
  }
  return null;
}

export function strokeHitTest(s, x, y) {
  const threshold = (s.width || 3) + 4;
  if (s.type === 'pencil' || s.type === 'line') {
    for (let i = 0; i < s.points.length - 1; i++) {
      if (ptSegDistSq(x, y, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y) < threshold ** 2) return true;
    }
  }
  return false;
}
