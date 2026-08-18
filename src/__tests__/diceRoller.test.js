/**
 * DiceRoller - production contract tests.
 *
 * The DiceRoller is used by chat-integrator, combat-manager, attack-modal,
 * and dice-helpers. This suite pins down the real API those callers rely on.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiceRoller } from '../dice-roller.js';

let roller;

beforeEach(() => { roller = new DiceRoller(null); });
afterEach(() => { vi.restoreAllMocks(); });

function stubRandom(values) {
  const seq = [...values];
  vi.spyOn(Math, 'random').mockImplementation(() => {
    if (seq.length === 0) throw new Error('stubRandom exhausted');
    return seq.shift();
  });
}

describe('DiceRoller.roll - success', () => {
  it('returns {formula, rolls, modifier, result} for simple notation', () => {
    stubRandom([0]); // rollDie(20) → 1
    const r = roller.roll('1d20');
    expect(r).toEqual({ formula: '1d20', rolls: [1], modifier: 0, result: 1 });
  });

  it('sums multiple dice and applies positive modifier', () => {
    stubRandom([0, 0.5]); // d6 → 1, d6 → 4
    const r = roller.roll('2d6+3');
    expect(r.rolls).toEqual([1, 4]);
    expect(r.modifier).toBe(3);
    expect(r.result).toBe(8);
  });

  it('applies negative modifier', () => {
    stubRandom([0.99]); // d8 → 8
    const r = roller.roll('1d8-2');
    expect(r.modifier).toBe(-2);
    expect(r.result).toBe(6);
  });

  it('is case-insensitive for the "d"', () => {
    stubRandom([0]);
    expect(roller.roll('1D20').result).toBe(1);
  });

  it('tolerates whitespace around notation', () => {
    stubRandom([0]);
    expect(roller.roll('  1d6  ').result).toBe(1);
  });

  it('preserves the original formula string', () => {
    stubRandom([0]);
    expect(roller.roll('  1D20+0  ').formula).toBe('  1D20+0  ');
  });
});

describe('DiceRoller.roll - errors', () => {
  it('throws on non-dice strings', () => {
    expect(() => roller.roll('banana')).toThrow(/invalid/i);
  });

  it('throws when die count exceeds 100', () => {
    expect(() => roller.roll('101d6')).toThrow(/too many/i);
  });

  it('throws when sides is below 2', () => {
    expect(() => roller.roll('1d1')).toThrow(/invalid die sides/i);
  });

  it('throws when sides exceeds 1000', () => {
    expect(() => roller.roll('1d1001')).toThrow(/invalid die sides/i);
  });

  it('throws on empty string', () => {
    expect(() => roller.roll('')).toThrow(/invalid/i);
  });

  it('throws on null/undefined input', () => {
    expect(() => roller.roll(null)).toThrow();
    expect(() => roller.roll(undefined)).toThrow();
  });
});

describe('DiceRoller.roll - edge cases', () => {
  it('defaults missing count to 1 (e.g. "d20")', () => {
    stubRandom([0.99]);
    const r = roller.roll('d20');
    expect(r.rolls).toHaveLength(1);
    expect(r.rolls[0]).toBe(20);
  });

  it('accepts zero modifier explicitly', () => {
    stubRandom([0]);
    const r = roller.roll('1d6+0');
    expect(r.modifier).toBe(0);
    expect(r.result).toBe(1);
  });

  it('accepts maximum allowed dice (100)', () => {
    stubRandom(Array(100).fill(0));
    const r = roller.roll('100d4');
    expect(r.rolls).toHaveLength(100);
    expect(r.result).toBe(100);
  });

  it('produces rolls within [1, sides] for every die', () => {
    stubRandom([0, 0.9999]);
    const r = roller.roll('2d6');
    for (const v of r.rolls) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe('DiceRoller.rollDie - success', () => {
  it('returns a value in [1, sides]', () => {
    stubRandom([0, 0.5, 0.9999]);
    expect(roller.rollDie(6)).toBe(1);
    expect(roller.rollDie(6)).toBe(4);
    expect(roller.rollDie(6)).toBe(6);
  });
});

describe('DiceRoller.rollDie - edge cases', () => {
  it('never returns 0 at the low end of Math.random', () => {
    stubRandom([0]);
    expect(roller.rollDie(20)).toBe(1);
  });

  it('never exceeds sides at the high end of Math.random', () => {
    stubRandom([0.9999999]);
    expect(roller.rollDie(20)).toBe(20);
  });
});

describe('DiceRoller.rollWithAdvantage - success', () => {
  it('returns {rolls, kept, modifier, result}', () => {
    stubRandom([0.5, 0.9]); // d20 → 11, 19
    const r = roller.rollWithAdvantage(20, 0);
    expect(r).toEqual({ rolls: [11, 19], kept: 19, modifier: 0, result: 19 });
  });

  it('keeps the higher of the two rolls', () => {
    stubRandom([0.9, 0.1]); // 19, 3
    expect(roller.rollWithAdvantage(20, 0).kept).toBe(19);
  });

  it('adds modifier to kept roll', () => {
    stubRandom([0.5, 0.1]); // 11, 3
    const r = roller.rollWithAdvantage(20, 5);
    expect(r.kept).toBe(11);
    expect(r.result).toBe(16);
  });
});

describe('DiceRoller.rollWithAdvantage - edge cases', () => {
  it('defaults modifier to 0 when omitted', () => {
    stubRandom([0, 0]);
    const r = roller.rollWithAdvantage(20);
    expect(r.modifier).toBe(0);
    expect(r.result).toBe(1);
  });

  it('handles equal rolls (kept equals both)', () => {
    stubRandom([0.5, 0.5]); // 11, 11
    const r = roller.rollWithAdvantage(20, 0);
    expect(r.kept).toBe(11);
    expect(r.rolls).toEqual([11, 11]);
  });

  it('accepts negative modifier', () => {
    stubRandom([0.95, 0.5]); // 20, 11
    const r = roller.rollWithAdvantage(20, -3);
    expect(r.kept).toBe(20);
    expect(r.result).toBe(17);
  });
});

describe('DiceRoller.rollWithDisadvantage - success', () => {
  it('returns {rolls, kept, modifier, result}', () => {
    stubRandom([0.5, 0.9]); // 11, 19
    const r = roller.rollWithDisadvantage(20, 0);
    expect(r).toEqual({ rolls: [11, 19], kept: 11, modifier: 0, result: 11 });
  });

  it('keeps the lower of the two rolls', () => {
    stubRandom([0.9, 0.1]); // 19, 3
    expect(roller.rollWithDisadvantage(20, 0).kept).toBe(3);
  });

  it('adds modifier to kept roll', () => {
    stubRandom([0.5, 0.95]); // 11, 20
    const r = roller.rollWithDisadvantage(20, 2);
    expect(r.kept).toBe(11);
    expect(r.result).toBe(13);
  });
});

describe('DiceRoller.rollWithDisadvantage - edge cases', () => {
  it('defaults modifier to 0 when omitted', () => {
    stubRandom([0, 0]);
    const r = roller.rollWithDisadvantage(20);
    expect(r.modifier).toBe(0);
    expect(r.result).toBe(1);
  });

  it('handles equal rolls (kept equals both)', () => {
    stubRandom([0.5, 0.5]); // 11, 11
    const r = roller.rollWithDisadvantage(20, 0);
    expect(r.kept).toBe(11);
  });

  it('accepts negative modifier', () => {
    stubRandom([0.05, 0.5]); // 2, 11
    const r = roller.rollWithDisadvantage(20, -1);
    expect(r.kept).toBe(2);
    expect(r.result).toBe(1);
  });
});
