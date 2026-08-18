/**
 * computeDerived - convenience for looking up a named formula from the
 * active ruleset and evaluating it with the given context. Returns null
 * when the ruleset has no such formula (callers degrade cleanly).
 */

import { describe, it, expect } from 'vitest';
import { computeDerived } from '../engine/computeDerived.js';
import dnd5e from '../content/rulesets/dnd5e.json';

describe('computeDerived', () => {
  it('evaluates the named formula with context + ruleset tables auto-injected', () => {
    expect(computeDerived(dnd5e, 'proficiency_bonus', { level: 5 })).toBe(3);
    expect(computeDerived(dnd5e, 'ability_mod', { score: 18 })).toBe(4);
  });

  it('auto-merges ruleset tables into context for $lookup', () => {
    // Caller should not have to pass tables manually
    expect(computeDerived(dnd5e, 'proficiency_bonus', { level: 1 })).toBe(2);
  });

  it('caller tables take precedence over ruleset tables', () => {
    const extra = { level: 1, tables: { proficiency_by_level: { 1: 99 } } };
    expect(computeDerived(dnd5e, 'proficiency_bonus', extra)).toBe(99);
  });

  it('returns null for an unknown formula name', () => {
    expect(computeDerived(dnd5e, 'not_a_thing', {})).toBeNull();
  });

  it('returns null when the ruleset has no formulas block at all', () => {
    expect(computeDerived({}, 'anything', {})).toBeNull();
    expect(computeDerived(null, 'anything', {})).toBeNull();
  });
});
