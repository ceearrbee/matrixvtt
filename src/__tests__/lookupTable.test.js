/**
 * Generic table lookup - works for any ruleset table:
 *   numeric-key progression tables (level → PB, level → XP),
 *   string-key category tables (CR string → XP, condition → description).
 *
 * Numeric keys support clamp-to-nearest so callers can skip edge cases.
 * String keys are exact-match; missing returns null.
 */

import { describe, it, expect } from 'vitest';
import { lookupTable } from '../engine/lookupTable.js';

describe('lookupTable - string keys', () => {
  const CR_XP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '5': 1800 };

  it('exact match returns the value', () => {
    expect(lookupTable(CR_XP, '1/4')).toBe(50);
    expect(lookupTable(CR_XP, '5')).toBe(1800);
  });

  it('numeric argument coerces to string', () => {
    expect(lookupTable(CR_XP, 5)).toBe(1800);
  });

  it('unknown key returns null', () => {
    expect(lookupTable(CR_XP, 'banana')).toBeNull();
    expect(lookupTable(CR_XP, '99')).toBeNull();
  });
});

describe('lookupTable - numeric keys with clamp', () => {
  const XP = { 1: 0, 2: 300, 5: 6500, 20: 355000 };

  it('exact match', () => {
    expect(lookupTable(XP, 5, { clamp: 'nearest' })).toBe(6500);
  });

  it('below minimum clamps to lowest', () => {
    expect(lookupTable(XP, 0, { clamp: 'nearest' })).toBe(0);
    expect(lookupTable(XP, -5, { clamp: 'nearest' })).toBe(0);
  });

  it('above maximum clamps to highest', () => {
    expect(lookupTable(XP, 99, { clamp: 'nearest' })).toBe(355000);
  });

  it('gap between defined keys returns null without clamp', () => {
    expect(lookupTable(XP, 3)).toBeNull();
  });

  it('clamp: "floor" returns the highest defined key ≤ input', () => {
    // XP → level: 6499 falls in "level 4" bucket (key 2 is 300, key 5 is 6500)
    // Actually this table is level→XP, but flooring by VALUE needs a different call.
    // Here we clamp by KEY: for key=3, floor finds key=2 (value 300).
    expect(lookupTable(XP, 3, { clamp: 'floor' })).toBe(300);
    expect(lookupTable(XP, 10, { clamp: 'floor' })).toBe(6500);
    expect(lookupTable(XP, 20, { clamp: 'floor' })).toBe(355000);
  });

  it('clamp: "floor" below minimum returns null (no floor exists)', () => {
    expect(lookupTable(XP, 0, { clamp: 'floor' })).toBeNull();
  });
});

describe('lookupTable - edge cases', () => {
  it('empty table returns null', () => {
    expect(lookupTable({}, 'x')).toBeNull();
    expect(lookupTable(null, 'x')).toBeNull();
    expect(lookupTable(undefined, 'x', { clamp: 'nearest' })).toBeNull();
  });
});
