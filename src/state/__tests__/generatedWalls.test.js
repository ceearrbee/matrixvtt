/**
 * Applying a generated layout's walls to a saved map.
 *
 * Explicit GM action, never automatic, and re-runnable: a GM who
 * rerolls the seed should get the new layout's walls, not both layouts'
 * walls on top of each other.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyGeneratedWalls } from '../writers/generated-walls.js';

function makeYMap(initial = []) {
  const inner = new Map(initial);
  return {
    set: vi.fn((k, v) => inner.set(k, v)),
    delete: vi.fn((k) => inner.delete(k)),
    has: (k) => inner.has(k),
    get: (k) => inner.get(k),
    doc: { transact: (fn) => fn() },
    _inner: inner,
  };
}

const GENERATED_MAP = {
  id: 'map-1', width_cells: 24, height_cells: 18, cell_px: 50,
  background: { kind: 'generated', generator: 'dungeon', seed: 'wall01', palette: 'dungeon', style: 'textured' },
};

function makeSm({ isGm = true, map = GENERATED_MAP, walls = [] } = {}) {
  const wallsMap = makeYMap(walls.map((w) => [w.id, w]));
  return {
    maps: new Map([[map.id, map]]),
    walls: wallsMap._inner,
    activeMapId: map.id,
    powerLevels: { users: isGm ? { '@gm:m': 50 } : {} },
    widgetManager: { userId: '@gm:m' },
    yjs: { wallsMap },
  };
}

describe('applyGeneratedWalls', () => {
  it('writes a wall per merged segment, tagged as generated', async () => {
    const sm = makeSm();
    const count = await applyGeneratedWalls(sm, 'map-1');
    expect(count).toBeGreaterThan(0);
    expect(sm.walls.size).toBe(count);
    for (const wall of sm.walls.values()) {
      expect(wall.map_id).toBe('map-1');
      expect(wall.source).toBe('generated');
      expect(wall.blocks_sight).toBe(true);
      expect(wall.p1).toHaveProperty('x');
    }
  });

  it('replaces the walls it generated before, rather than doubling them', async () => {
    const sm = makeSm();
    const first = await applyGeneratedWalls(sm, 'map-1');
    const second = await applyGeneratedWalls(sm, 'map-1');
    expect(second).toBe(first);
    expect(sm.walls.size).toBe(first);
  });

  it('leaves walls the GM drew by hand alone', async () => {
    const hand = { id: 'w-hand', map_id: 'map-1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, blocks_sight: true };
    const sm = makeSm({ walls: [hand] });
    await applyGeneratedWalls(sm, 'map-1');
    expect(sm.walls.get('w-hand')).toEqual(hand);
  });

  it('leaves the generated walls of another map alone', async () => {
    const other = { id: 'w-other', map_id: 'map-2', source: 'generated', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, blocks_sight: true };
    const sm = makeSm({ walls: [other] });
    await applyGeneratedWalls(sm, 'map-1');
    expect(sm.walls.get('w-other')).toEqual(other);
  });

  it('refuses a map with no generated background', async () => {
    const sm = makeSm({ map: { id: 'map-1', width_cells: 10, height_cells: 10, cell_px: 50 } });
    expect(await applyGeneratedWalls(sm, 'map-1')).toBe(0);
    expect(sm.walls.size).toBe(0);
  });

  it('refuses a map that does not exist', async () => {
    const sm = makeSm();
    expect(await applyGeneratedWalls(sm, 'nope')).toBe(0);
  });

  it('is GM only, like every other wall write', async () => {
    const sm = makeSm({ isGm: false });
    await expect(applyGeneratedWalls(sm, 'map-1')).rejects.toThrow(/GM/i);
  });

  it('writes everything in one transaction, so peers see one update', async () => {
    const sm = makeSm();
    const transact = vi.spyOn(sm.yjs.wallsMap.doc, 'transact');
    await applyGeneratedWalls(sm, 'map-1');
    expect(transact).toHaveBeenCalledTimes(1);
  });
});
