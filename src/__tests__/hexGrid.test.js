/**
 * Hex-grid pure geometry helpers.
 * Using axial (q, r) coordinates - simplest scheme for flat-top/pointy hexes.
 */

import { describe, it, expect } from 'vitest';
import { hexDistance } from '../utils/hexGrid.js';

describe('hexDistance', () => {
  it('is 0 for the same hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it('is 1 between adjacent hexes', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1);
  });

  it('matches the axial distance formula', () => {
    // q=2, r=-1 → cube (2, -1, -1) → max(|2|, |-1|, |-1|) = 2
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(hexDistance({ q: 1, r: 2 }, { q: 4, r: -1 })).toBe(3);
  });
});

