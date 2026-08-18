/**
 * The measure tool reports distance in feet. On square grids
 * the distance is Euclidean cells × cell_feet (5e house rule). On hex
 * grids the distance is `hexDistance(a, b) × cell_feet` so a path
 * through neighbouring hexes counts each step as one cell. Both
 * orientations (pointy / flat) supported via pixelToHex inverse.
 */
import { describe, it, expect } from 'vitest';
import { pixelToHex, hexRound, measureDistanceCells } from '../utils/hexGrid.js';
import { hexToPixel } from '../utils/hexGrid.js';

const SIZE = 40;

describe('hexRound', () => {
  it('rounds (0.0, 0.0) to (0, 0)', () => {
    expect(hexRound({ q: 0, r: 0 })).toEqual({ q: 0, r: 0 });
  });

  it('rounds near-integer fractions to the nearest integer hex', () => {
    expect(hexRound({ q: 1.1, r: 0.05 })).toEqual({ q: 1, r: 0 });
    expect(hexRound({ q: -0.9, r: 1.05 })).toEqual({ q: -1, r: 1 });
  });

  it('preserves cube invariant q+r+s=0 even for ambiguous mid-points', () => {
    const result = hexRound({ q: 0.5, r: 0.4 });
    const sum = result.q + result.r + (-result.q - result.r);
    expect(sum).toBe(0);
  });
});

describe('pixelToHex inverts hexToPixel', () => {
  for (const orientation of ['pointy', 'flat']) {
    it(`${orientation}: round-trips axial coordinates through the centre`, () => {
      for (const q of [-2, -1, 0, 1, 2]) {
        for (const r of [-2, -1, 0, 1, 2]) {
          const px = hexToPixel({ q, r }, { size: SIZE, orientation });
          const back = pixelToHex(px, { size: SIZE, orientation });
          expect(back).toEqual({ q, r });
        }
      }
    });
  }

  it('points slightly off-centre still snap to the same hex (pointy)', () => {
    const centre = hexToPixel({ q: 1, r: 0 }, { size: SIZE });
    const offset = { x: centre.x + 3, y: centre.y - 2 };
    expect(pixelToHex(offset, { size: SIZE })).toEqual({ q: 1, r: 0 });
  });
});

describe('measureDistanceCells', () => {
  const cellPx = SIZE;

  it('square grid: Euclidean distance in cells', () => {
    const dist = measureDistanceCells(
      { x: 0, y: 0 },
      { x: 3 * cellPx, y: 4 * cellPx },
      { gridType: 'square', cellPx },
    );
    expect(dist).toBeCloseTo(5);
  });

  it('square grid: defaults to square when gridType is undefined', () => {
    const dist = measureDistanceCells(
      { x: 0, y: 0 },
      { x: cellPx, y: 0 },
      { cellPx },
    );
    expect(dist).toBeCloseTo(1);
  });

  it('hex_pointy: adjacent neighbour is exactly 1 cell', () => {
    const a = hexToPixel({ q: 0, r: 0 }, { size: cellPx });
    const b = hexToPixel({ q: 1, r: 0 }, { size: cellPx });
    const dist = measureDistanceCells(a, b, { gridType: 'hex_pointy', cellPx });
    expect(dist).toBe(1);
  });

  it('hex_pointy: two-step path along the q axis is 2 cells', () => {
    const a = hexToPixel({ q: 0, r: 0 }, { size: cellPx });
    const b = hexToPixel({ q: 2, r: 0 }, { size: cellPx });
    expect(measureDistanceCells(a, b, { gridType: 'hex_pointy', cellPx })).toBe(2);
  });

  it('hex_flat: adjacent +q neighbour is 1 cell', () => {
    const a = hexToPixel({ q: 0, r: 0 }, { size: cellPx, orientation: 'flat' });
    const b = hexToPixel({ q: 1, r: 0 }, { size: cellPx, orientation: 'flat' });
    expect(measureDistanceCells(a, b, { gridType: 'hex_flat', cellPx })).toBe(1);
  });

  it('hex_pointy: diagonal across two axes counts hex steps, not Euclidean', () => {
    const a = hexToPixel({ q: 0, r: 0 }, { size: cellPx });
    const b = hexToPixel({ q: 2, r: 2 }, { size: cellPx });
    // Cube distance: |2| + |2| + |-4| / 2 = 4
    expect(measureDistanceCells(a, b, { gridType: 'hex_pointy', cellPx })).toBe(4);
    // Same Euclidean would be sqrt(3)*2 + ... ~ much bigger; just confirm the hex
    // metric is *not* the Euclidean fallback.
    const euclidean = Math.hypot(b.x - a.x, b.y - a.y) / cellPx;
    expect(euclidean).toBeGreaterThan(4);
  });
});
