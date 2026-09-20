/**
 * Terrain grid primitives shared by every generator.
 */
import { describe, it, expect } from 'vitest';
import { TERRAIN, makeGrid, at, setAt, largestRegion } from '../map/generators/terrain.js';

describe('makeGrid', () => {
  it('allocates width * height cells filled with the given code', () => {
    const g = makeGrid(4, 3, TERRAIN.WALL);
    expect(g.width).toBe(4);
    expect(g.height).toBe(3);
    expect(g.cells.length).toBe(12);
    expect([...new Set(g.cells)]).toEqual([TERRAIN.WALL]);
  });
});

describe('at / setAt', () => {
  it('reads and writes by column and row', () => {
    const g = makeGrid(3, 3, TERRAIN.WALL);
    setAt(g, 1, 2, TERRAIN.FLOOR);
    expect(at(g, 1, 2)).toBe(TERRAIN.FLOOR);
    expect(at(g, 0, 0)).toBe(TERRAIN.WALL);
  });

  it('treats out-of-bounds reads as wall rather than wrapping', () => {
    const g = makeGrid(3, 3, TERRAIN.FLOOR);
    expect(at(g, -1, 0)).toBe(TERRAIN.WALL);
    expect(at(g, 3, 0)).toBe(TERRAIN.WALL);
    expect(at(g, 0, -1)).toBe(TERRAIN.WALL);
    expect(at(g, 0, 3)).toBe(TERRAIN.WALL);
  });

  it('ignores out-of-bounds writes', () => {
    const g = makeGrid(2, 2, TERRAIN.WALL);
    setAt(g, 5, 5, TERRAIN.FLOOR);
    expect([...new Set(g.cells)]).toEqual([TERRAIN.WALL]);
  });
});

describe('largestRegion', () => {
  it('returns the biggest connected run of a code', () => {
    const g = makeGrid(5, 1, TERRAIN.WALL);
    setAt(g, 0, 0, TERRAIN.FLOOR);
    setAt(g, 2, 0, TERRAIN.FLOOR);
    setAt(g, 3, 0, TERRAIN.FLOOR);
    const region = largestRegion(g, TERRAIN.FLOOR);
    expect(region.size).toBe(2);
    expect(region.has(2)).toBe(true);
    expect(region.has(3)).toBe(true);
  });

  it('is empty when the code is absent', () => {
    expect(largestRegion(makeGrid(3, 3, TERRAIN.WALL), TERRAIN.FLOOR).size).toBe(0);
  });

  it('connects orthogonally, not diagonally', () => {
    const g = makeGrid(2, 2, TERRAIN.WALL);
    setAt(g, 0, 0, TERRAIN.FLOOR);
    setAt(g, 1, 1, TERRAIN.FLOOR);
    expect(largestRegion(g, TERRAIN.FLOOR).size).toBe(1);
  });
});
