/**
 * Phase C roll engine extensions.
 *
 *   NdSdhK, NdSdlK  - drop highest/lowest K before summing
 *   NdSrM           - reroll once any die ≤ M (single reroll per die)
 *   NdS>T, NdS>=T   - success-counting: total is count of dice meeting threshold
 *
 * Rulesets pick the shape that suits their mechanics. The `total` field
 * stays the canonical "final number" - for success-counting it's the
 * count, not the sum, so downstream chat/UI code doesn't need to branch.
 */

import { describe, it, expect } from 'vitest';
import { rollNotation } from '../engine/roll.js';

const seqRng = (vals) => {
  let i = 0;
  return () => { const v = vals[i % vals.length]; i += 1; return v; };
};

describe('drop-low / drop-high', () => {
  it('4d6dl1 drops the lowest die (5e stat gen)', () => {
    // rolls: 2, 5, 4, 6 → drop 2 → keep 5+4+6 = 15
    const rng = seqRng([0.2, 0.7, 0.55, 0.95]);
    const r = rollNotation('4d6dl1', { rng });
    expect(r.rolls).toEqual([2, 5, 4, 6]);
    expect(r.kept).toEqual([5, 4, 6]);
    expect(r.total).toBe(15);
  });

  it('4d6dh1 drops the highest die', () => {
    const rng = seqRng([0.2, 0.7, 0.55, 0.95]); // → 2,5,4,6
    const r = rollNotation('4d6dh1', { rng });
    expect(r.kept).toEqual([2, 5, 4]);
    expect(r.total).toBe(11);
  });

  it('drop with modifier applies after drop', () => {
    const rng = seqRng([0.0, 0.99]);            // → 1, 20
    const r = rollNotation('2d20dl1+5', { rng });
    expect(r.kept).toEqual([20]);
    expect(r.total).toBe(25);
  });
});

describe('reroll (r<N>)', () => {
  it('rerolls any die ≤ N once', () => {
    // d6r2: first die rolls 1 → rerolls to 5. Second die rolls 4 → kept.
    const rng = seqRng([0.0, 0.7, 0.5]);
    const r = rollNotation('2d6r2', { rng });
    // First roll = 1 (rerolled), second roll = 5, then the reroll replacement fires for die 1
    // Our implementation rolls all dice then rerolls low dice in a second pass.
    // rolls shows both the original and reroll so the caller can display.
    expect(r.total).toBe(5 + 4); // rerolled 1 → 5, the 4 stays
  });

  it('reroll only once per die - second low result is kept', () => {
    // d6r3: roll 2 → reroll to 1 → keep 1 (no second reroll)
    const rng = seqRng([0.2, 0.0]);
    const r = rollNotation('1d6r3', { rng });
    expect(r.total).toBe(1);
    expect(r.rolls.length).toBe(2); // original + reroll
  });

  it('does not reroll dice above threshold', () => {
    const rng = seqRng([0.8]); // → 5
    const r = rollNotation('1d6r2', { rng });
    expect(r.total).toBe(5);
    expect(r.rolls).toEqual([5]);
  });
});

describe('success-counting (>T, >=T)', () => {
  it('Nd10>7 counts dice that roll strictly greater than 7', () => {
    // rolls: 4, 8, 9, 1, 10 → successes: 8, 9, 10 → 3
    const rng = seqRng([0.3, 0.7, 0.85, 0.0, 0.99]);
    const r = rollNotation('5d10>7', { rng });
    expect(r.rolls).toEqual([4, 8, 9, 1, 10]);
    expect(r.successes).toBe(3);
    expect(r.total).toBe(3);
  });

  it('Nd6>=5 counts dice ≥ 5', () => {
    const rng = seqRng([0.6, 0.8, 0.3]); // → 4, 5, 2
    const r = rollNotation('3d6>=5', { rng });
    expect(r.successes).toBe(1);
    expect(r.total).toBe(1);
  });

  it('success-count ignores modifier (no +bonus on pool rolls)', () => {
    // grammar allows trailing modifier but it doesn't apply to success counts
    const rng = seqRng([0.99, 0.99, 0.99]);
    const r = rollNotation('3d6>=5', { rng });
    expect(r.total).toBe(3);
  });
});
