/**
 * Cellular-automata cavern. Random noise, smoothed until it clumps into
 * chambers, then reduced to its largest connected region so nothing is
 * stranded behind solid rock.
 */

import { TERRAIN, makeGrid, at, setAt, largestRegion } from './terrain.js';

export function generateCave({ rng, width, height, params }) {
  const grid = makeGrid(width, height, TERRAIN.WALL);

  for (let row = 1; row < height - 1; row += 1) {
    for (let col = 1; col < width - 1; col += 1) {
      if (rng() * 100 >= params.fill) setAt(grid, col, row, TERRAIN.FLOOR);
    }
  }

  for (let pass = 0; pass < params.smoothing; pass += 1) smooth(grid);
  keepLargestChamber(grid);
  addPools(grid, rng, params.water);
  return grid;
}

function smooth(grid) {
  const next = new Uint8Array(grid.cells);
  for (let row = 1; row < grid.height - 1; row += 1) {
    for (let col = 1; col < grid.width - 1; col += 1) {
      const walls = countWalls(grid, col, row);
      next[row * grid.width + col] = walls > 4 ? TERRAIN.WALL : TERRAIN.FLOOR;
    }
  }
  grid.cells.set(next);
}

function countWalls(grid, col, row) {
  let walls = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dc === 0 && dr === 0) continue;
      if (at(grid, col + dc, row + dr) === TERRAIN.WALL) walls += 1;
    }
  }
  return walls;
}

function keepLargestChamber(grid) {
  const keep = largestRegion(grid, TERRAIN.FLOOR);
  for (let i = 0; i < grid.cells.length; i += 1) {
    if (grid.cells[i] === TERRAIN.FLOOR && !keep.has(i)) grid.cells[i] = TERRAIN.WALL;
  }
}

/**
 * Turn a few deep pockets into water. Only cells ringed by floor
 * qualify, so a pool never blocks the one route through a passage.
 *
 * Scattered cells are then clumped: grown once into their neighbours,
 * then stripped of any that are still alone. Without that pass the
 * result is speckle that reads as a rendering artifact, not a pool.
 */
function addPools(grid, rng, chance) {
  if (chance <= 0) return;
  const seeds = [];
  for (let row = 1; row < grid.height - 1; row += 1) {
    for (let col = 1; col < grid.width - 1; col += 1) {
      if (at(grid, col, row) !== TERRAIN.FLOOR) continue;
      if (countWalls(grid, col, row) > 0) continue;
      if (rng() * 100 < chance) seeds.push([col, row]);
    }
  }
  for (const [col, row] of seeds) setAt(grid, col, row, TERRAIN.WATER);
  for (const [col, row] of seeds) growPool(grid, rng, col, row);
  removeLonePools(grid);
}

function growPool(grid, rng, col, row) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (rng() < 0.55) continue;
    const nc = col + dc;
    const nr = row + dr;
    if (at(grid, nc, nr) !== TERRAIN.FLOOR) continue;
    if (countWalls(grid, nc, nr) > 0) continue;
    setAt(grid, nc, nr, TERRAIN.WATER);
  }
}

function removeLonePools(grid) {
  const lone = [];
  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      if (at(grid, col, row) !== TERRAIN.WATER) continue;
      const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dc, dr]) => at(grid, col + dc, row + dr) === TERRAIN.WATER);
      if (!touching) lone.push([col, row]);
    }
  }
  for (const [col, row] of lone) setAt(grid, col, row, TERRAIN.FLOOR);
}
