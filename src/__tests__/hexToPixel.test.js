/**
 * Convert axial hex coords to pixel centres.
 * Two orientations: pointy-top (horizontal rows) and flat-top (vertical columns).
 * Using the standard formulas from redblobgames.com/grids/hexagons/.
 */

import { describe, it, expect } from 'vitest';
import { hexToPixel } from '../utils/hexGrid.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('hexToPixel', () => {
  it('origin hex is at (0, 0) regardless of orientation', () => {
    expect(hexToPixel({ q: 0, r: 0 }, { size: 10 })).toEqual({ x: 0, y: 0 });
    expect(hexToPixel({ q: 0, r: 0 }, { size: 10, orientation: 'flat' }))
      .toEqual({ x: 0, y: 0 });
  });

  it('pointy-top: +q shifts by √3·size on x, +r shifts by √3/2·size on x and 3/2·size on y', () => {
    const s = 10;
    const p = hexToPixel({ q: 1, r: 0 }, { size: s });
    expect(close(p.x, Math.sqrt(3) * s)).toBe(true);
    expect(close(p.y, 0)).toBe(true);

    const q = hexToPixel({ q: 0, r: 1 }, { size: s });
    expect(close(q.x, (Math.sqrt(3) / 2) * s)).toBe(true);
    expect(close(q.y, 1.5 * s)).toBe(true);
  });

  it('flat-top: +q shifts by 3/2·size on x, +r shifts by √3·size on y', () => {
    const s = 10;
    const p = hexToPixel({ q: 1, r: 0 }, { size: s, orientation: 'flat' });
    expect(close(p.x, 1.5 * s)).toBe(true);
    expect(close(p.y, (Math.sqrt(3) / 2) * s)).toBe(true);

    const q = hexToPixel({ q: 0, r: 1 }, { size: s, orientation: 'flat' });
    expect(close(q.x, 0)).toBe(true);
    expect(close(q.y, Math.sqrt(3) * s)).toBe(true);
  });
});
