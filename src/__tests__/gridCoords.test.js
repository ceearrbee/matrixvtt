import { describe, it, expect } from 'vitest';
import { cellToPixel } from '../utils/grid-coords.js';

describe('cellToPixel', () => {
  const map40 = { cell_px: 40 };
  const SQRT3 = Math.sqrt(3);

  it('square grid returns cell centre', () => {
    expect(cellToPixel(map40, 0, 0)).toEqual({ x: 20, y: 20 });
    expect(cellToPixel(map40, 2, 3)).toEqual({ x: 100, y: 140 });
  });

  it('defaults to square when gridType is omitted', () => {
    expect(cellToPixel(map40, 1, 1)).toEqual({ x: 60, y: 60 });
  });

  it('pointy-top hex staggers odd rows right by dx/2', () => {
    const dx = SQRT3 * 40;
    const even = cellToPixel(map40, 0, 0, 'hex_pointy');
    const odd = cellToPixel(map40, 0, 1, 'hex_pointy');
    expect(even.x).toBe(0);
    expect(odd.x).toBeCloseTo(dx / 2);
  });

  it('flat-top hex staggers odd columns down by dy/2', () => {
    const dy = SQRT3 * 40;
    const even = cellToPixel(map40, 0, 0, 'hex_flat');
    const odd = cellToPixel(map40, 1, 0, 'hex_flat');
    expect(even.y).toBe(0);
    expect(odd.y).toBeCloseTo(dy / 2);
  });

  it('falls back to 40px when cell_px is missing', () => {
    expect(cellToPixel({}, 0, 0)).toEqual({ x: 20, y: 20 });
  });
});
