/**
 * The generators. Pure, no DOM: given a seed and a size they return a
 * cell grid. The contract that matters is determinism (every client
 * paints the same map from the stored seed) and connectivity (a map
 * with stranded floor is not a map anyone can play on).
 */
import { describe, it, expect } from 'vitest';
import { TERRAIN, at } from '../map/generators/terrain.js';
import { GENERATORS, generateTerrain } from '../map/generators/index.js';

const SIZES = [[20, 15], [40, 30], [8, 8]];

// Rubble and pools are terrain a token stands in, not terrain it is
// blocked by, so "reachable" has to mean passable, not literally FLOOR.
const PASSABLE = new Set([TERRAIN.FLOOR, TERRAIN.ROUGH, TERRAIN.WATER]);

function floorCount(grid) {
  return grid.cells.reduce((n, c) => n + (c === TERRAIN.FLOOR ? 1 : 0), 0);
}

function passableCount(grid) {
  return grid.cells.reduce((n, c) => n + (PASSABLE.has(c) ? 1 : 0), 0);
}

function allPassableConnected(grid) {
  const start = grid.cells.findIndex((c) => PASSABLE.has(c));
  if (start < 0) return true;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const index = queue.pop();
    const col = index % grid.width;
    const row = (index - col) / grid.width;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= grid.width || nr >= grid.height) continue;
      const next = nr * grid.width + nc;
      if (seen.has(next) || !PASSABLE.has(grid.cells[next])) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size === passableCount(grid);
}

describe('GENERATORS registry', () => {
  it('keys every entry by its own id', () => {
    for (const [key, gen] of Object.entries(GENERATORS)) expect(gen.id).toBe(key);
  });

  it('gives every generator a label and defaults the form can render', () => {
    for (const gen of Object.values(GENERATORS)) {
      expect(gen.label).toBeTruthy();
      expect(gen.defaults).toBeTypeOf('object');
      for (const p of gen.params) {
        expect(p.key).toBeTruthy();
        expect(p.min).toBeLessThan(p.max);
        expect(gen.defaults[p.key]).toBeGreaterThanOrEqual(p.min);
        expect(gen.defaults[p.key]).toBeLessThanOrEqual(p.max);
      }
    }
  });
});

describe.each(Object.keys(GENERATORS))('generator: %s', (id) => {
  it('is deterministic for the same seed and size', () => {
    const a = generateTerrain({ generator: id, seed: 'a7f3c2', width: 30, height: 20 });
    const b = generateTerrain({ generator: id, seed: 'a7f3c2', width: 30, height: 20 });
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });

  it('gives a different layout for a different seed', () => {
    const a = generateTerrain({ generator: id, seed: 'one', width: 30, height: 20 });
    const b = generateTerrain({ generator: id, seed: 'two', width: 30, height: 20 });
    expect(Array.from(a.cells)).not.toEqual(Array.from(b.cells));
  });

  it.each(SIZES)('fills exactly %ix%i cells with known terrain', (w, h) => {
    const grid = generateTerrain({ generator: id, seed: 'sized', width: w, height: h });
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    expect(grid.cells.length).toBe(w * h);
    const known = new Set(Object.values(TERRAIN));
    for (const code of grid.cells) expect(known.has(code)).toBe(true);
  });

  it.each(SIZES)('leaves floor to stand on at %ix%i', (w, h) => {
    const grid = generateTerrain({ generator: id, seed: 'floor', width: w, height: h });
    expect(floorCount(grid)).toBeGreaterThan(0);
  });

  // The quality gate. A pretty layout with an unreachable room is a bug,
  // and it is the one a human would not notice until mid-session.
  it.each(SIZES)('leaves every passable cell reachable at %ix%i', (w, h) => {
    const grid = generateTerrain({ generator: id, seed: 'reach', width: w, height: h });
    expect(allPassableConnected(grid)).toBe(true);
  });

  it('walls the outer border so tokens cannot walk off the map', () => {
    const grid = generateTerrain({ generator: id, seed: 'border', width: 24, height: 18 });
    for (let c = 0; c < grid.width; c += 1) {
      expect(at(grid, c, 0)).not.toBe(TERRAIN.FLOOR);
      expect(at(grid, c, grid.height - 1)).not.toBe(TERRAIN.FLOOR);
    }
    for (let r = 0; r < grid.height; r += 1) {
      expect(at(grid, 0, r)).not.toBe(TERRAIN.FLOOR);
      expect(at(grid, grid.width - 1, r)).not.toBe(TERRAIN.FLOOR);
    }
  });

  it('clamps a param far outside its declared range instead of honouring it', () => {
    const gen = GENERATORS[id];
    const wild = Object.fromEntries(gen.params.map((p) => [p.key, 99999]));
    const grid = generateTerrain({ generator: id, seed: 'clamp', width: 30, height: 20, params: wild });
    expect(grid.cells.length).toBe(600);
    expect(allPassableConnected(grid)).toBe(true);
  });

  // A wide corridor carved near the edge used to punch through the
  // outer wall, which only showed up at the top of the clamp range.
  it('keeps the border walled even at the widest corridor setting', () => {
    const gen = GENERATORS[id];
    const wild = Object.fromEntries(gen.params.map((p) => [p.key, p.max]));
    const grid = generateTerrain({ generator: id, seed: 'wide', width: 24, height: 18, params: wild });
    for (let c = 0; c < grid.width; c += 1) {
      expect(at(grid, c, 0)).toBe(TERRAIN.WALL);
      expect(at(grid, c, grid.height - 1)).toBe(TERRAIN.WALL);
    }
  });

  it('survives a map at the smallest bound the schema allows', () => {
    const grid = generateTerrain({ generator: id, seed: 'tiny', width: 1, height: 1 });
    expect(grid.cells.length).toBe(1);
  });
});

describe('generateTerrain guards', () => {
  it('returns null for an unknown generator rather than throwing', () => {
    expect(generateTerrain({ generator: 'hologram', seed: 'x', width: 10, height: 10 })).toBeNull();
  });

  it('returns null for a missing or absurd seed', () => {
    expect(generateTerrain({ generator: 'dungeon', seed: '', width: 10, height: 10 })).toBeNull();
    expect(generateTerrain({ generator: 'dungeon', seed: 'x'.repeat(40), width: 10, height: 10 })).toBeNull();
    expect(generateTerrain({ generator: 'dungeon', seed: 'bad seed!', width: 10, height: 10 })).toBeNull();
  });

  it('returns null for a size outside the map bounds', () => {
    expect(generateTerrain({ generator: 'dungeon', seed: 'x', width: 0, height: 10 })).toBeNull();
    expect(generateTerrain({ generator: 'dungeon', seed: 'x', width: 10, height: 500 })).toBeNull();
  });
});

describe('dungeon', () => {
  it('carves rooms joined by corridors, not one open field', () => {
    const grid = generateTerrain({ generator: 'dungeon', seed: 'rooms', width: 40, height: 30 });
    const floors = floorCount(grid);
    expect(floors).toBeGreaterThan(40);
    expect(floors).toBeLessThan(grid.cells.length * 0.6);
  });
});

describe('cave', () => {
  // Scattering water cell by cell left lone dark squares that read as
  // rendering artifacts rather than pools.
  it('leaves no single-cell pool stranded on its own', () => {
    const grid = generateTerrain({ generator: 'cave', seed: 'pools', width: 50, height: 40, params: { water: 25 } });
    const isWater = (c, r) => c >= 0 && r >= 0 && c < grid.width && r < grid.height
      && grid.cells[r * grid.width + c] === TERRAIN.WATER;
    for (let row = 0; row < grid.height; row += 1) {
      for (let col = 0; col < grid.width; col += 1) {
        if (!isWater(col, row)) continue;
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => isWater(col + dc, row + dr));
        expect(neighbours.length, `pool at ${col},${row}`).toBeGreaterThan(0);
      }
    }
  });

  it('opens up more floor as the fill ratio drops', () => {
    const open = generateTerrain({ generator: 'cave', seed: 'f', width: 40, height: 30, params: { fill: 38 } });
    const tight = generateTerrain({ generator: 'cave', seed: 'f', width: 40, height: 30, params: { fill: 52 } });
    expect(floorCount(open)).toBeGreaterThan(floorCount(tight));
  });
});
