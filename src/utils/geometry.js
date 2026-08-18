/**
 * Geometry utilities for token hit detection and distance calculations.
 */

import { pixelToHex, hexDistance } from './hexGrid.js';

/**
 * Return token IDs whose centre falls within the circle.
 *
 * On a hex grid (`options.gridType === 'hex_pointy' | 'hex_flat'`), token
 * centres are snapped to their hex and cube-distance is compared against
 * `radiusFeet / cellFeet` cells. On a square grid (default) the test
 * stays Euclidean.
 */
export function getTokensInCircle(tokens, center, radiusFeet, cellPx, cellFeet, options = {}) {
  const { gridType } = options;
  const isHex = gridType === 'hex_pointy' || gridType === 'hex_flat';
  const orientation = gridType === 'hex_flat' ? 'flat' : 'pointy';
  const radiusCells = radiusFeet / cellFeet;
  const radiusPx = radiusCells * cellPx;
  const radiusPxSq = radiusPx * radiusPx;
  const centerHex = isHex ? pixelToHex(center, { size: cellPx, orientation }) : null;
  const result = [];
  for (const [id, token] of tokens) {
    const tx = token.x !== undefined ? token.x : (token.col + (token.size || 1) / 2) * cellPx;
    const ty = token.y !== undefined ? token.y : (token.row + (token.size || 1) / 2) * cellPx;
    if (isHex) {
      const tokenHex = pixelToHex({ x: tx, y: ty }, { size: cellPx, orientation });
      if (hexDistance(centerHex, tokenHex) <= radiusCells) result.push(id);
    } else {
      const dx = tx - center.x;
      const dy = ty - center.y;
      if (dx * dx + dy * dy <= radiusPxSq) result.push(id);
    }
  }
  return result;
}

/**
 * Return token IDs inside a cone (arc sector) pointing in direction.
 *
 * On a hex grid (`options.gridType === 'hex_pointy' | 'hex_flat'`), the
 * length test is performed in cube-distance - same approach as
 * `getTokensInCircle` - so the cone footprint matches what players
 * count on the grid. The angle test stays Euclidean: cone arc is a
 * real-space concept, hex coordinates only constrain the radius.
 */
export function getTokensInCone(tokens, origin, directionRad, lengthFeet, arcDegrees, cellPx, cellFeet, options = {}) {
  const { gridType } = options;
  const isHex = gridType === 'hex_pointy' || gridType === 'hex_flat';
  const orientation = gridType === 'hex_flat' ? 'flat' : 'pointy';
  const lengthCells = lengthFeet / cellFeet;
  const lengthPx = lengthCells * cellPx;
  const halfArcRad = (arcDegrees / 2) * (Math.PI / 180);
  const originHex = isHex ? pixelToHex(origin, { size: cellPx, orientation }) : null;
  const result = [];

  for (const [id, token] of tokens) {
    const tx = token.x !== undefined ? token.x : (token.col + (token.size || 1) / 2) * cellPx;
    const ty = token.y !== undefined ? token.y : (token.row + (token.size || 1) / 2) * cellPx;
    const dx = tx - origin.x;
    const dy = ty - origin.y;

    if (isHex) {
      const tokenHex = pixelToHex({ x: tx, y: ty }, { size: cellPx, orientation });
      if (hexDistance(originHex, tokenHex) > lengthCells) continue;
    } else {
      if (dx * dx + dy * dy > lengthPx * lengthPx) continue;
    }

    const angle = Math.atan2(ty - origin.y, tx - origin.x);
    let diff = angle - directionRad;
    while (diff > Math.PI)  diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) <= halfArcRad) {
      result.push(id);
    }
  }
  return result;
}

/**
 * Segment-segment intersection test in 2D (proper or endpoint-touching).
 * All arguments are `{x, y}` points.
 */
export function segmentsIntersect(a1, a2, b1, b2) {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false;
  const dx = b1.x - a1.x, dy = b1.y - a1.y;
  const t = (dx * d2y - dy * d2x) / denom;
  const u = (dx * d1y - dy * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * True when any sight-blocking wall intersects the segment `a→b`.
 */
export function segmentBlockedByWalls(a, b, walls) {
  if (!walls) return false;
  for (const w of walls) {
    if (w?.blocks_sight === false) continue;
    if (!w?.p1 || !w?.p2) continue;
    if (segmentsIntersect(a, b, w.p1, w.p2)) return true;
  }
  return false;
}

/**
 * Point-to-segment distance squared.
 */
export function ptSegDistSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return (px - x1) ** 2 + (py - y1) ** 2;
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  if (t < 0) return (px - x1) ** 2 + (py - y1) ** 2;
  if (t > 1) return (px - x2) ** 2 + (py - y2) ** 2;
  return (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2;
}
