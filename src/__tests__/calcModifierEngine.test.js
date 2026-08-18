/**
 * calcModifier delegates to computeDerived(ruleset, 'ability_mod', {score}).
 * No legacy modifier.type switch - rulesets are spec-conforming JSON.
 */

import { describe, it, expect } from 'vitest';
import { calcModifier } from '../ui/character-calculations.js';
import dnd5e from '../content/rulesets/dnd5e.json';
import ose from '../content/rulesets/ose.json';

describe('calcModifier', () => {
  it('5e: floor((score - 10) / 2)', () => {
    expect(calcModifier(dnd5e, 10)).toBe(0);
    expect(calcModifier(dnd5e, 16)).toBe(3);
    expect(calcModifier(dnd5e, 8)).toBe(-1);
    expect(calcModifier(dnd5e, 20)).toBe(5);
  });

  it('OSR: lookup from ability_mod_osr table', () => {
    expect(calcModifier(ose, 3)).toBe(-3);
    expect(calcModifier(ose, 9)).toBe(0);
    expect(calcModifier(ose, 18)).toBe(3);
  });

  it('returns null when ruleset has no ability_mod formula', () => {
    expect(calcModifier({}, 10)).toBeNull();
    expect(calcModifier(null, 10)).toBeNull();
  });

  it('custom formula overrides behaviour entirely', () => {
    const flat = { formulas: { ability_mod: '@score' } };
    expect(calcModifier(flat, 7)).toBe(7);
  });
});
