/**
 * Backlog: `token.facing` (radians) is written by the facing tool but never
 * rendered. Add a pure geometry helper so the renderer can draw an arrow, and
 * test the math in isolation.
 */

import { describe, it, expect } from 'vitest';
import { facingArrowEnd } from '../map/layers/tokens.js';

describe('facingArrowEnd', () => {
  it('returns null when facing is absent', () => {
    expect(facingArrowEnd({ x: 10, y: 10, radius: 5 })).toBeNull();
    expect(facingArrowEnd({ x: 10, y: 10, radius: 5, facing: null })).toBeNull();
  });

  it('facing 0 points right', () => {
    const p = facingArrowEnd({ x: 100, y: 100, radius: 20, facing: 0 });
    expect(p.x).toBeCloseTo(125);
    expect(p.y).toBeCloseTo(100);
  });

  it('facing π/2 points down (canvas y-down)', () => {
    const p = facingArrowEnd({ x: 100, y: 100, radius: 20, facing: Math.PI / 2 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(125);
  });

  it('facing π points left', () => {
    const p = facingArrowEnd({ x: 100, y: 100, radius: 20, facing: Math.PI });
    expect(p.x).toBeCloseTo(75);
    expect(p.y).toBeCloseTo(100);
  });

  it('arrow extends 5px beyond radius', () => {
    const p = facingArrowEnd({ x: 0, y: 0, radius: 10, facing: 0 });
    expect(p.x).toBeCloseTo(15);
  });
});
