/**
 * deriveCharacterSaves reads ruleset.saves[]. Character-level explicit
 * saving_throws override derivation. Empty saves[] means "no saves".
 */

import { describe, it, expect } from 'vitest';
import { deriveCharacterSaves } from '../ui/character-calculations.js';
import dnd5e from '../content/rulesets/dnd5e.json';

describe('deriveCharacterSaves', () => {
  const char = { attributes: { str: 14, dex: 10, con: 12, int: 8, wis: 16, cha: 10 } };

  it('uses saves[] with the engine ability_mod formula', () => {
    const saves = deriveCharacterSaves(dnd5e, char);
    expect(saves.Strength).toBe(2);
    expect(saves.Wisdom).toBe(3);
  });

  it('character-level explicit saves override derivation', () => {
    const out = deriveCharacterSaves(dnd5e, {
      attributes: { str: 10 },
      saving_throws: { 'Fort': 99 },
    });
    expect(out).toEqual({ Fort: 99 });
  });

  it('saves: [] signals "system has no saves" → returns null', () => {
    const sys = { ...dnd5e, saves: [] };
    expect(deriveCharacterSaves(sys, { attributes: { str: 10 } })).toBeNull();
  });

  it('missing saves[] falls back to one save per attribute', () => {
    // Minimal ruleset with formula but no saves block
    const minimal = {
      formulas: { ability_mod: { $: 'floor', args: [{ $: '/', args: [{ $: '-', args: ['@score', 10] }, 2] }] } },
    };
    const out = deriveCharacterSaves(minimal, { attributes: { str: 14, dex: 8 } });
    expect(out.str).toBe(2);
    expect(out.dex).toBe(-1);
  });
});
