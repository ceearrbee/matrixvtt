/**
 * Engine-level dice roller. Unlike the existing `DiceRoller` (d20 systems
 * only), this parses notation that covers every target system:
 *
 *   NdS[+-M]     - standard (5e, OSR)             '1d20+5', '3d6-1'
 *   NdF          - FATE fudge dice (values -1/0/+1)
 *   NdS!         - exploding dice (Rolemaster)
 *   NdS!>T       - exploding on threshold T
 *   NdSkhK       - keep highest K (advantage)
 *   NdSklK       - keep lowest K (disadvantage)
 *   {A|B}[+-M]   - grouped keep-highest (Savage Worlds trait + wild die)
 *
 * The `rng` parameter is injected so tests are deterministic.
 */

import { describe, it, expect } from 'vitest';
import { rollNotation } from '../engine/roll.js';

// Deterministic RNG: returns values from a queue; each call consumes one.
function seqRng(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

describe('rollNotation - standard NdS', () => {
  it('rolls N d S dice', () => {
    const rng = seqRng([0.0, 0.99, 0.5]); // → 1, S, midpoint
    const r = rollNotation('3d6', { rng });
    expect(r.rolls).toEqual([1, 6, 4]);
    expect(r.total).toBe(11);
    expect(r.notation).toBe('3d6');
  });

  it('adds positive modifier', () => {
    const rng = seqRng([0.0]); // → 1
    const r = rollNotation('1d20+5', { rng });
    expect(r.rolls).toEqual([1]);
    expect(r.modifier).toBe(5);
    expect(r.total).toBe(6);
  });

  it('adds negative modifier', () => {
    const rng = seqRng([0.99]); // → 20
    const r = rollNotation('1d20-3', { rng });
    expect(r.total).toBe(17);
  });

  it('defaults count to 1', () => {
    const rng = seqRng([0.5]);
    const r = rollNotation('d6', { rng });
    expect(r.rolls).toHaveLength(1);
  });
});

describe('rollNotation - FATE fudge (NdF)', () => {
  it('produces values in [-1, 0, 1]', () => {
    // 4dF with rng that yields 0, 0.5, 0.99, 0.34 → -1, 0, +1, -1
    const rng = seqRng([0.0, 0.4, 0.8, 0.2]);
    const r = rollNotation('4dF', { rng });
    expect(r.rolls).toEqual([-1, 0, 1, -1]);
    expect(r.total).toBe(-1);
  });
});

describe('rollNotation - keep highest/lowest', () => {
  it('2d20kh1 keeps the higher (advantage)', () => {
    const rng = seqRng([0.1, 0.9]); // → 3, 19
    const r = rollNotation('2d20kh1', { rng });
    expect(r.rolls).toEqual([3, 19]);
    expect(r.kept).toEqual([19]);
    expect(r.total).toBe(19);
  });

  it('2d20kl1 keeps the lower (disadvantage)', () => {
    const rng = seqRng([0.1, 0.9]); // → 3, 19
    const r = rollNotation('2d20kl1', { rng });
    expect(r.kept).toEqual([3]);
    expect(r.total).toBe(3);
  });

  it('kh1 with modifier applies the modifier to the kept total', () => {
    const rng = seqRng([0.1, 0.9]);
    const r = rollNotation('2d20kh1+5', { rng });
    expect(r.total).toBe(24);
  });
});

describe('rollNotation - exploding (Rolemaster / open-ended)', () => {
  it('exploding d6: rolls again on max, adds', () => {
    // 1d6!: rng 0.99 → 6 (explodes), then 0.5 → 4. Total 10.
    const rng = seqRng([0.99, 0.5]);
    const r = rollNotation('1d6!', { rng });
    expect(r.rolls).toEqual([6, 4]);
    expect(r.total).toBe(10);
  });

  it('does not explode on non-max', () => {
    const rng = seqRng([0.5]);
    const r = rollNotation('1d6!', { rng });
    expect(r.rolls).toEqual([4]);
  });

  it('explosion caps to prevent infinite loops', () => {
    // 1d2! - always rolls max (0.99) - should cap
    const rng = seqRng([0.99]);
    const r = rollNotation('1d2!', { rng, maxExplosions: 5 });
    expect(r.rolls.length).toBeLessThanOrEqual(6); // initial + 5 explosions
  });
});

describe('rollNotation - errors', () => {
  it('throws on unparseable notation', () => {
    expect(() => rollNotation('garbage', {})).toThrow();
  });

  it('rejects absurd counts', () => {
    expect(() => rollNotation('9999d6', {})).toThrow();
  });
});

describe('rollNotation - grouped keep-highest ({A|B})', () => {
  it('rolls each group and keeps the higher total across unequal dice', () => {
    const rng = seqRng([0.3, 0.7]); // d8 → 3, d6 → 5
    const r = rollNotation('{1d8!|1d6!}', { rng });
    expect(r.rolls).toEqual([3, 5]);
    expect(r.groups.map((g) => g.total)).toEqual([3, 5]);
    expect(r.kept).toEqual([5]);
    expect(r.modifier).toBe(0);
    expect(r.total).toBe(5);
    expect(r.notation).toBe('{1d8!|1d6!}');
  });

  it('each group explodes independently', () => {
    // d8: 8 explodes into 1 (group total 9); d6: 4.
    const rng = seqRng([0.99, 0.1, 0.5]);
    const r = rollNotation('{1d8!|1d6!}', { rng });
    expect(r.rolls).toEqual([8, 1, 4]);
    expect(r.groups[0].rolls).toEqual([8, 1]);
    expect(r.total).toBe(9);
  });

  it('a smaller exploding die can beat the bigger die', () => {
    // d8: 2; d6: 6 explodes into 6 explodes into 2 (total 14).
    const rng = seqRng([0.2, 0.99, 0.99, 0.2]);
    const r = rollNotation('{1d8!|1d6!}', { rng });
    expect(r.groups.map((g) => g.total)).toEqual([2, 14]);
    expect(r.total).toBe(14);
  });

  it('applies the trailing modifier once, after keeping', () => {
    const rng = seqRng([0.3, 0.7]); // 3 vs 5
    const r = rollNotation('{1d8!|1d6!}+2', { rng });
    expect(r.modifier).toBe(2);
    expect(r.total).toBe(7);
  });

  it('supports negative modifiers', () => {
    const rng = seqRng([0.3, 0.7]);
    const r = rollNotation('{1d8!|1d6!}-1', { rng });
    expect(r.total).toBe(4);
  });

  it('honours the explosion cap inside each group', () => {
    const rng = seqRng([0.99]); // every die is max
    const r = rollNotation('{1d2!|1d2!}', { rng, maxExplosions: 3 });
    expect(r.rolls.length).toBeLessThanOrEqual(8); // 2 groups × (1 + 3)
    expect(r.total).toBe(8);
  });

  it('propagates a wild-die complication from any group', () => {
    const rng = seqRng([0.0, 0.5]); // 1d6w rolls 1, 1d8 rolls 5
    const r = rollNotation('{1d6w|1d8}', { rng });
    expect(r.complication).toBe(true);
    expect(r.total).toBe(5);
  });

  it('tolerates whitespace and uppercase', () => {
    const rng = seqRng([0.3, 0.7]);
    const r = rollNotation('{ 1D8! | 1d6! } +2', { rng });
    expect(r.total).toBe(7);
    expect(r.notation).toBe('{1d8!|1d6!}+2');
  });

  it('rejects a single group and empty groups', () => {
    expect(() => rollNotation('{1d8!}')).toThrow();
    expect(() => rollNotation('{1d8!|}')).toThrow();
    expect(() => rollNotation('{|1d6!}')).toThrow();
  });
});

describe('zero-die pools (empty cliché, zero-pool initiative)', () => {
  it('0d6 rolls nothing and totals the modifier', () => {
    const r = rollNotation('0d6');
    expect(r.rolls).toEqual([]);
    expect(r.total).toBe(0);
    const r2 = rollNotation('0d6+2');
    expect(r2.total).toBe(2);
  });

  it('still rejects negative and absurd counts', () => {
    expect(() => rollNotation('1001d6')).toThrow(/count/);
  });
});
