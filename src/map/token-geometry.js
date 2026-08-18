/**
 * src/map/token-geometry.js - pure geometry helpers for tokens.
 */

export function getTokenRadius(token, cellSize) {
  const size = token?.size || 1;
  if (size === 1) return cellSize * 0.375;
  return (size * cellSize) / 2 - 2;
}
