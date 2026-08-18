/**
 * Exhaustion level tracking - getExhaustionEffect / formatExhaustionLabel
 *
 * D&D 5e has 6 exhaustion tiers with cumulative mechanical effects.
 * Exhaustion is stored as token.exhaustion_level (integer 0–6).
 */

import { describe, it, expect } from 'vitest';
import { getExhaustionEffect, formatExhaustionLabel } from '../ui/exhaustion.js';

describe('getExhaustionEffect', () => {
  it('returns null for level 0 (no exhaustion)', () => {
    expect(getExhaustionEffect(0)).toBeNull();
  });

  it('returns level 1 effect: disadvantage on ability checks', () => {
    const e = getExhaustionEffect(1);
    expect(e?.toLowerCase()).toMatch(/disadvantage/);
    expect(e?.toLowerCase()).toMatch(/ability check/);
  });

  it('returns level 3 effect: speed halved', () => {
    const e = getExhaustionEffect(3);
    expect(e?.toLowerCase()).toMatch(/speed/);
  });

  it('returns level 6 effect: death', () => {
    const e = getExhaustionEffect(6);
    expect(e?.toLowerCase()).toMatch(/death/);
  });

  it('returns null for invalid levels', () => {
    expect(getExhaustionEffect(-1)).toBeNull();
    expect(getExhaustionEffect(7)).toBeNull();
  });
});

describe('formatExhaustionLabel', () => {
  it('returns empty string for level 0', () => {
    expect(formatExhaustionLabel(0)).toBe('');
  });

  it('includes the level number', () => {
    expect(formatExhaustionLabel(2)).toContain('2');
  });

  it('includes "Exhaustion" in the label', () => {
    expect(formatExhaustionLabel(3).toLowerCase()).toContain('exhaustion');
  });
});
