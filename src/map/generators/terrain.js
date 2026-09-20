/**
 * The cell grid every generator produces, and the few operations they
 * share. A plain Uint8Array of terrain codes indexed `row * width + col`:
 * cheap to allocate, cheap to compare in a test, and trivially
 * serialisable if it ever needs to be.
 */

export const TERRAIN = Object.freeze({
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  WATER: 3,
  ROUGH: 4,
});

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [fill] - terrain code to prefill with
 */
export function makeGrid(width, height, fill = TERRAIN.VOID) {
  const cells = new Uint8Array(width * height);
  if (fill !== 0) cells.fill(fill);
  return { width, height, cells };
}

/** Out of bounds reads as wall, so generators never special-case edges. */
export function at(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return TERRAIN.WALL;
  return grid.cells[row * grid.width + col];
}

export function setAt(grid, col, row, code) {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return;
  grid.cells[row * grid.width + col] = code;
}

/**
 * Indices of the largest orthogonally-connected region of `code`.
 *
 * This is what keeps a generated map playable: a cave that smooths into
 * two islands would strand tokens, so the generator keeps this region
 * and fills the rest in.
 */
export function largestRegion(grid, code) {
  const { width, height, cells } = grid;
  const seen = new Uint8Array(cells.length);
  let best = new Set();

  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== code || seen[i]) continue;
    const region = new Set();
    const queue = [i];
    seen[i] = 1;
    while (queue.length > 0) {
      const index = queue.pop();
      region.add(index);
      const col = index % width;
      const row = (index - col) / width;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
        const next = nr * width + nc;
        if (seen[next] || cells[next] !== code) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (region.size > best.size) best = region;
  }
  return best;
}
