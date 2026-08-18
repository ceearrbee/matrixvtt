/**
 * K2: OpenD6-style wild die support.
 *
 * Notation: `NdSw` - the FIRST die in the pool is the "wild die".
 *   - Wild die explodes on max (reroll-and-add, cascading).
 *   - Wild die rolling 1 sets `complication: true` on the result.
 *   - Other dice behave as plain NdS (no explosion, no flag).
 *
 * The wild marker `w` is mutually exclusive with the ambient `!` explode
 * flag - a wild-die pool already has bespoke explosion behaviour.
 */

import { describe, it, expect } from 'vitest';
import { rollNotation } from '../engine/roll.js';

const seqRng = (vals) => {
  let i = 0;
  return () => { const v = vals[i % vals.length]; i += 1; return v; };
};

describe('wild die (NdSw)', () => {
  it('plain pool: wild die sits at index 0, rest are normal', () => {
    // 3d6w: wild (0.5 → 4), normal (0.1 → 1), normal (0.8 → 5)
    const r = rollNotation('3d6w', { rng: seqRng([0.5, 0.1, 0.8]) });
    expect(r.rolls).toEqual([4, 1, 5]);
    expect(r.total).toBe(10);
    expect(r.complication).toBeFalsy();
  });

  it('wild die on max explodes (reroll + add)', () => {
    // 2d6w: wild (0.99 → 6, then 0.5 → 4), normal (0.2 → 2)
    const r = rollNotation('2d6w', { rng: seqRng([0.99, 0.5, 0.2]) });
    expect(r.rolls).toEqual([6, 4, 2]);    // wild exploded to 6+4, then the normal 2
    expect(r.total).toBe(6 + 4 + 2);
    expect(r.complication).toBeFalsy();
  });

  it('wild die chains multiple explosions', () => {
    // 1d6w: wild 6 → 6 → 3. No other dice.
    const r = rollNotation('1d6w', { rng: seqRng([0.99, 0.99, 0.4]) });
    expect(r.rolls).toEqual([6, 6, 3]);
    expect(r.total).toBe(15);
  });

  it('wild die rolling 1 flags complication', () => {
    // 3d6w: wild (0.0 → 1), normal (0.5 → 4), normal (0.8 → 5)
    const r = rollNotation('3d6w', { rng: seqRng([0.0, 0.5, 0.8]) });
    expect(r.rolls).toEqual([1, 4, 5]);
    expect(r.complication).toBe(true);
    expect(r.total).toBe(10);
  });

  it('normal-die 1 does NOT flag complication (only the wild die does)', () => {
    // 3d6w: wild (0.5 → 4), normal (0.0 → 1), normal (0.8 → 5)
    const r = rollNotation('3d6w', { rng: seqRng([0.5, 0.0, 0.8]) });
    expect(r.complication).toBeFalsy();
  });

  it('wild die combines with a flat modifier', () => {
    const r = rollNotation('2d6w+2', { rng: seqRng([0.5, 0.2]) });
    expect(r.rolls).toEqual([4, 2]);
    expect(r.total).toBe(4 + 2 + 2);
    expect(r.modifier).toBe(2);
  });
});
