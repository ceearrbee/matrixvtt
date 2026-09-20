/**
 * Walls derived from a generated layout, so a generated dungeon can
 * arrive with working line of sight.
 *
 * Colinear runs are merged: one segment per cell edge would put ~900
 * walls on a 40x30 dungeon, and the fog path tests every wall for every
 * revealed cell. Merging takes that to a couple of hundred.
 */
import { describe, it, expect } from 'vitest';
import { TERRAIN, makeGrid, setAt } from '../map/generators/terrain.js';
import { wallsFromTerrain } from '../map/generators/walls-from-terrain.js';
import { generateTerrain } from '../map/generators/index.js';

const CELL = 50;
const PASSABLE = new Set([TERRAIN.FLOOR, TERRAIN.ROUGH, TERRAIN.WATER]);

/** One boundary per cell side, i.e. what merging is measured against. */
function rawEdgeCount(grid) {
  let edges = 0;
  for (let r = 0; r < grid.height; r += 1) {
    for (let c = 0; c < grid.width; c += 1) {
      if (!PASSABLE.has(grid.cells[r * grid.width + c])) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        const out = nc < 0 || nr < 0 || nc >= grid.width || nr >= grid.height;
        if (out || !PASSABLE.has(grid.cells[nr * grid.width + nc])) edges += 1;
      }
    }
  }
  return edges;
}

/** A single open room inset from the border. */
function room(w = 6, h = 4) {
  const grid = makeGrid(w + 2, h + 2, TERRAIN.WALL);
  for (let r = 1; r <= h; r += 1) {
    for (let c = 1; c <= w; c += 1) setAt(grid, c, r, TERRAIN.FLOOR);
  }
  return grid;
}

describe('wallsFromTerrain', () => {
  it('merges each side of an open room into one segment', () => {
    const walls = wallsFromTerrain(room(), CELL);
    expect(walls.length).toBe(4);
  });

  it('puts the segments in pixels, on the room boundary', () => {
    const walls = wallsFromTerrain(room(6, 4), CELL);
    const xs = walls.flatMap((w) => [w.p1.x, w.p2.x]);
    const ys = walls.flatMap((w) => [w.p1.y, w.p2.y]);
    expect(Math.min(...xs)).toBe(CELL);
    expect(Math.max(...xs)).toBe(7 * CELL);
    expect(Math.min(...ys)).toBe(CELL);
    expect(Math.max(...ys)).toBe(5 * CELL);
  });

  it('marks every segment as blocking sight and movement', () => {
    for (const wall of wallsFromTerrain(room(), CELL)) {
      expect(wall.blocks_sight).toBe(true);
      expect(wall.blocks_movement).toBe(true);
    }
  });

  it('returns nothing for a grid with no floor at all', () => {
    expect(wallsFromTerrain(makeGrid(5, 5, TERRAIN.WALL), CELL)).toEqual([]);
  });

  it('returns nothing for a missing grid', () => {
    expect(wallsFromTerrain(null, CELL)).toEqual([]);
  });

  it('walls two separate rooms independently', () => {
    const grid = makeGrid(12, 5, TERRAIN.WALL);
    for (const x0 of [1, 7]) {
      for (let r = 1; r <= 3; r += 1) {
        for (let c = x0; c < x0 + 4; c += 1) setAt(grid, c, r, TERRAIN.FLOOR);
      }
    }
    expect(wallsFromTerrain(grid, CELL).length).toBe(8);
  });

  it('treats rubble and pools as floor, not as rock to wall off', () => {
    const grid = room();
    setAt(grid, 2, 2, TERRAIN.ROUGH);
    setAt(grid, 3, 2, TERRAIN.WATER);
    expect(wallsFromTerrain(grid, CELL).length).toBe(4);
  });

  // The number the fog cost was measured against.
  // Merging pays off unevenly: a dungeon's straight room walls collapse
  // about 3.5x, a cave's jagged boundary only about 1.4x. Caves have
  // fewer raw edges to begin with, so both land near the same absolute
  // count, which is the number the fog cost was measured against.
  it.each([['dungeon', 2.5], ['cave', 1.2]])('merges %s edges by at least %fx', (generator, ratio) => {
    const grid = generateTerrain({ generator, seed: 'walls2', width: 40, height: 30 });
    const merged = wallsFromTerrain(grid, CELL);
    expect(merged.length).toBeGreaterThan(0);
    expect(rawEdgeCount(grid) / merged.length).toBeGreaterThanOrEqual(ratio);
  });

  it.each(['dungeon', 'cave'])('keeps %s under the 200-wall budget the fog cost assumed', (generator) => {
    const grid = generateTerrain({ generator, seed: 'walls2', width: 40, height: 30 });
    expect(wallsFromTerrain(grid, CELL).length).toBeLessThan(200);
  });
});
