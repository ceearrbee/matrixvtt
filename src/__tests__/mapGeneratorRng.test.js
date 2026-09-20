/**
 * Seeded RNG. The whole descriptor design rests on this: a map stores a
 * seed, and every client must paint the identical picture from it.
 */
import { describe, it, expect } from 'vitest';
import { makeRng, randomSeed, seedToInt } from '../map/generators/rng.js';

const draws = (rng, n = 16) => Array.from({ length: n }, () => rng());

describe('makeRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draws(makeRng('a7f3c2'))).toEqual(draws(makeRng('a7f3c2')));
  });

  it('diverges quickly for different seeds', () => {
    const a = draws(makeRng('seed-one'), 4);
    const b = draws(makeRng('seed-two'), 4);
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const values = draws(makeRng('range'), 500);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('treats a number seed and its string form alike', () => {
    expect(draws(makeRng(1234), 4)).toEqual(draws(makeRng('1234'), 4));
  });

  it('is stable across calls, so the hash is not order-dependent', () => {
    expect(seedToInt('crypt')).toBe(seedToInt('crypt'));
    expect(seedToInt('crypt')).not.toBe(seedToInt('crypts'));
  });
});

describe('randomSeed', () => {
  it('produces a short slug a GM can read out and retype', () => {
    const seed = randomSeed(makeRng('fixed'));
    expect(seed).toMatch(/^[a-z0-9]{6}$/);
  });

  it('produces a different seed from a different source', () => {
    expect(randomSeed(makeRng('one'))).not.toBe(randomSeed(makeRng('two')));
  });
});
