/**
 * Speech bubble lifetime + theme.
 *
 * Lifetime: `max(5000, body.length * 90)` ms - short bodies take the
 * 5 s minimum (enough to read "Whoah!"), long bodies scale up so a
 * 60-char message reads through cleanly.
 *
 * Theme: bubble background / stroke / text colour come from the theme
 * palette (`mr._colors.bubbleBg/bubbleBorder/bubbleText`) instead of the
 * previous hardcoded near-black / white triple.
 */
import { describe, it, expect } from 'vitest';
import { computeBubbleLifetime } from '../map/layers/speech-bubbles.js';

describe('computeBubbleLifetime', () => {
  it('uses the 5000 ms floor for short bodies', () => {
    expect(computeBubbleLifetime('Hi!')).toBe(5000);
    expect(computeBubbleLifetime('Whoah!')).toBe(5000);
    expect(computeBubbleLifetime('')).toBe(5000);
  });

  it('scales linearly with length for long bodies', () => {
    // 100 chars × 90 ms = 9000 ms
    expect(computeBubbleLifetime('x'.repeat(100))).toBe(9000);
    // 200 chars × 90 ms = 18000 ms
    expect(computeBubbleLifetime('x'.repeat(200))).toBe(18000);
  });

  it('the crossover is at ~56 chars (5000 ÷ 90 = 55.5)', () => {
    expect(computeBubbleLifetime('x'.repeat(55))).toBe(5000);
    expect(computeBubbleLifetime('x'.repeat(57))).toBe(57 * 90);
  });

  it('coerces nullish bodies to the floor (no crash)', () => {
    expect(computeBubbleLifetime(null)).toBe(5000);
    expect(computeBubbleLifetime(undefined)).toBe(5000);
  });
});
