/**
 * Right-click "Add Token Here" must pass non-negative col/row even when
 * the click lands past the panned origin (negative world coords). The
 * token schema requires col >= 0 / row >= 0 - without clamping, the
 * resulting "Add Token Here" → form → submit silently failed validation.
 */
import { describe, it, expect } from 'vitest';
import { clampToMap } from '../map/input/clamp-coords.js';

describe('clampToMap', () => {
  const map = { width_cells: 12, height_cells: 8 };

  it('clamps negative col/row to 0', () => {
    expect(clampToMap(map, -5, -10)).toEqual({ col: 0, row: 0 });
  });

  it('clamps col/row past the map size to the last in-bounds cell', () => {
    expect(clampToMap(map, 99, 99)).toEqual({ col: 11, row: 7 });
  });

  it('leaves in-bounds coords untouched', () => {
    expect(clampToMap(map, 3, 5)).toEqual({ col: 3, row: 5 });
  });

  it('floors floats', () => {
    expect(clampToMap(map, 3.7, 5.2)).toEqual({ col: 3, row: 5 });
  });

  it('falls back to 0/0 when the map is missing', () => {
    expect(clampToMap(null, -1, 2)).toEqual({ col: 0, row: 0 });
  });
});
