/**
 * grid-coords.js - single source of truth for converting a token's (col, row)
 * integer coordinates into a pixel centre on the map canvas. Used by both
 * render passes and hit-testing so click-to-select works regardless of grid
 * orientation.
 *
 * Pointy-top hex: rows are staggered. Odd rows shifted right by dx/2.
 * Flat-top  hex: columns are staggered. Odd columns shifted down by dy/2.
 * Square: the simple `(col + 0.5) * cell_px` case.
 *
 * Hex math mirrors `_renderHexGrid` in `src/map/Rendering.js`.
 */

const SQRT3 = Math.sqrt(3);

/**
 * @param {{cell_px?: number}} map - the active room map; `cell_px` is the hex
 *   outer radius on hex grids and the square side length on square grids.
 * @param {number} col
 * @param {number} row
 * @param {string} [gridType='square'] - 'square' | 'hex_pointy' | 'hex_flat'
 * @returns {{x: number, y: number}} pixel centre
 */
export function cellToPixel(map, col, row, gridType = 'square') {
  const size = map?.cell_px ?? 40;
  if (gridType === 'hex_pointy') {
    const dx = SQRT3 * size;
    const dy = 1.5 * size;
    return { x: col * dx + (row % 2 === 1 ? dx / 2 : 0), y: row * dy + size };
  }
  if (gridType === 'hex_flat') {
    const dx = 1.5 * size;
    const dy = SQRT3 * size;
    return { x: col * dx + size, y: row * dy + (col % 2 === 1 ? dy / 2 : 0) };
  }
  // square default
  return { x: (col + 0.5) * size, y: (row + 0.5) * size };
}
