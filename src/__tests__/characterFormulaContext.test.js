import { describe, it, expect } from 'vitest';
import { buildCharacterFormulaContext } from '../engine/characterFormulaContext.js';
import dnd5e from '../content/rulesets/dnd5e.json' with { type: 'json' };
import { computeDerived } from '../engine/computeDerived.js';

describe('buildCharacterFormulaContext', () => {
  it('populates per-attribute mods via the ability_mod formula', () => {
    const character = {
      level: 5,
      attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 },
    };
    const ctx = buildCharacterFormulaContext(dnd5e, character);
    expect(ctx.str.mod).toBe(3);
    expect(ctx.dex.mod).toBe(1);
    expect(ctx.con.mod).toBe(2);
    expect(ctx.int.mod).toBe(0);
    expect(ctx.wis.mod).toBe(1);
    expect(ctx.cha.mod).toBe(-1);
  });

  it('derives proficiency bonus from the level lookup table', () => {
    const character = {
      level: 5,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    expect(buildCharacterFormulaContext(dnd5e, character).derived.pb).toBe(3);
  });

  it('sets cast.mod from the character.spellcasting_ability attribute', () => {
    const character = {
      level: 5,
      spellcasting_ability: 'wis',
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    };
    expect(buildCharacterFormulaContext(dnd5e, character).cast.mod).toBe(4);
  });

  it('defaults cast.mod to 0 when no spellcasting_ability declared', () => {
    const character = {
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    expect(buildCharacterFormulaContext(dnd5e, character).cast.mod).toBe(0);
  });

  it('builds proficient.<skill> flags from skill_proficiencies', () => {
    const character = {
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skill_proficiencies: ['perception', 'stealth'],
    };
    const ctx = buildCharacterFormulaContext(dnd5e, character);
    expect(ctx.proficient.perception).toBe(true);
    expect(ctx.proficient.stealth).toBe(true);
    expect(ctx.proficient.athletics).toBeUndefined();
  });

  it('passive_perception resolves end-to-end via the real ruleset', () => {
    const character = {
      level: 5,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      skill_proficiencies: ['perception'],
    };
    const ctx = buildCharacterFormulaContext(dnd5e, character);
    // 10 + wis mod (2) + pb (3, proficient) + 0 = 15
    expect(computeDerived(dnd5e, 'passive_perception', ctx)).toBe(15);
  });

  it('spell_save_dc resolves end-to-end via the real ruleset', () => {
    const character = {
      level: 5,
      spellcasting_ability: 'int',
      attributes: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    };
    const ctx = buildCharacterFormulaContext(dnd5e, character);
    // 8 + pb(3) + int.mod(3) = 14
    expect(computeDerived(dnd5e, 'spell_save_dc', ctx)).toBe(14);
  });

  it('returns a sensible ctx for rulesets without ability_mod (e.g. Savage Worlds)', () => {
    const fakeSystem = { formulas: {}, tables: {} };
    const character = {
      level: 1,
      attributes: { vigor: 'd6', strength: 'd8' },
    };
    const ctx = buildCharacterFormulaContext(fakeSystem, character);
    // Attribute mods default to 0 when ability_mod is absent.
    expect(ctx.vigor.mod).toBe(0);
    expect(ctx.strength.mod).toBe(0);
    expect(ctx.derived.pb).toBe(0);
    expect(ctx.cast.mod).toBe(0);
  });

  it('exposes extras (e.g. inventory) alongside derived slots', () => {
    const character = {
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    const inv = [{ id: 'itm-1' }];
    const ctx = buildCharacterFormulaContext(dnd5e, character, { inventory: inv });
    expect(ctx.inventory).toBe(inv);
  });
});
