/**
 * Edge-case coverage for the JSON-AST formula evaluator. The original
 * suite (`evaluate.test.js`) only exercises happy paths. Real rulesets
 * have division operators (passive perception bonuses, save DCs) and
 * arbitrary lookups that can hit zero or undefined values. Without
 * these guards, derived numbers silently become Infinity / NaN and
 * propagate into AC, damage, etc.
 *
 * The contract this file locks in:
 *   - `/` by 0 (or by null/undefined that coerces to 0) → 0, not Infinity.
 *   - empty `max` / `min` → 0, not ±Infinity.
 *   - operator args that aren't arrays → null, no throw.
 *   - path traversal cannot reach `__proto__`, `constructor`, or `prototype`.
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../engine/evaluate.js';

describe('evaluate - division edge cases', () => {
  it('returns 0 for division by literal 0 instead of Infinity', () => {
    const result = evaluate({ $: '/', args: [10, 0] });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('returns 0 for division by null/undefined (coerces to 0)', () => {
    expect(evaluate({ $: '/', args: [10, null] })).toBe(0);
    expect(evaluate({ $: '/', args: [10, undefined] })).toBe(0);
  });

  it('returns 0 for 0 / 0 (NaN candidate)', () => {
    const result = evaluate({ $: '/', args: [0, 0] });
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBe(0);
  });

  it('still divides normally for non-zero denominators', () => {
    expect(evaluate({ $: '/', args: [10, 2] })).toBe(5);
    expect(evaluate({ $: '/', args: [20, 4, 5] })).toBe(1);
  });
});

describe('evaluate - empty min/max', () => {
  it('returns 0 for empty max instead of -Infinity', () => {
    const result = evaluate({ $: 'max', args: [] });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('returns 0 for empty min instead of Infinity', () => {
    const result = evaluate({ $: 'min', args: [] });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('still works normally with one or more args', () => {
    expect(evaluate({ $: 'max', args: [1, 2, 3] })).toBe(3);
    expect(evaluate({ $: 'min', args: [1, 2, 3] })).toBe(1);
  });
});

describe('evaluate - malformed args', () => {
  it('returns null when args is a string rather than an array', () => {
    expect(evaluate({ $: '+', args: 'not-an-array' })).toBeNull();
    expect(evaluate({ $: '*', args: 42 })).toBeNull();
  });

  it('returns null when args is an object', () => {
    expect(evaluate({ $: '+', args: { foo: 'bar' } })).toBeNull();
  });

  it('returns null for unknown operators (existing behavior)', () => {
    expect(evaluate({ $: 'nope', args: [1, 2] })).toBeNull();
  });

  it('handles missing args (treats as empty array)', () => {
    expect(evaluate({ $: '+' })).toBe(0);
    expect(evaluate({ $: '*' })).toBe(1);
  });
});

describe('evaluate - path traversal safety', () => {
  it('does not resolve @__proto__ paths', () => {
    expect(evaluate('@__proto__', { x: 1 })).toBeNull();
    expect(evaluate('@__proto__.polluted', { x: 1 })).toBeNull();
  });

  it('does not resolve @constructor paths', () => {
    expect(evaluate('@constructor', { x: 1 })).toBeNull();
    expect(evaluate('@constructor.prototype', { x: 1 })).toBeNull();
  });

  it('does not resolve @prototype paths', () => {
    expect(evaluate('@prototype', { x: 1 })).toBeNull();
  });

  it('still resolves legitimate paths', () => {
    expect(evaluate('@x', { x: 7 })).toBe(7);
    expect(evaluate('@stats.str.mod', { stats: { str: { mod: 4 } } })).toBe(4);
  });
});
