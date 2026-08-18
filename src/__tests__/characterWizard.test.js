/**
 * Character creation wizard tests
 *
 * buildCharacterFromWizardData(data, system) merges wizard form data into a
 * partial character object ready for createCharacter().
 */

import { describe, it, expect } from 'vitest';
import { buildCharacterFromWizardData, getWizardSteps } from '../ui/character-wizard.js';
import { ENTITY_TYPES } from '../utils/constants.js';
import risus from '../content/rulesets/risus.json';
import fate from '../content/rulesets/fate.json';

describe('buildCharacterFromWizardData', () => {
  const baseData = {
    name: 'Aelindra',
    race: 'Elf',
    class: 'Ranger',
    background: 'Outlander',
    level: 3,
    hp_max: 24,
    ac: 15,
    speed: 30,
    strength: 10,
    dexterity: 16,
    constitution: 14,
    intelligence: 12,
    wisdom: 14,
    charisma: 8
  };

  it('maps all wizard fields to the character object', () => {
    const char = buildCharacterFromWizardData(baseData, 'dnd5e');
    
    expect(char.name).toBe('Aelindra');
    expect(char.race).toBe('Elf');
    expect(char.class).toBe('Ranger');
    expect(char.background).toBe('Outlander');
    expect(char.level).toBe(3);
    expect(char.hp_max).toBe(24);
    expect(char.hp_current).toBe(24);
    expect(char.ac).toBe(15);
    expect(char.speed).toBe(30);
    expect(char.attributes.strength).toBe(10);
    expect(char.attributes.dexterity).toBe(16);
    expect(char.type).toBe(ENTITY_TYPES.PC);
  });

  it('handles missing fields with sensible defaults', () => {
    // Only name provided
    const char = buildCharacterFromWizardData({ name: 'Minimal' }, 'dnd5e');
    
    expect(char.name).toBe('Minimal');
    expect(char.level).toBe(1);
    expect(char.hp_max).toBeNull(); // Current implementation uses data.hp_max ?? null
    expect(char.ac).toBe(10);
    expect(char.attributes.strength).toBe(10);
    expect(char.attributes.wisdom).toBe(10);
  });

  it('handles an entirely empty data object', () => {
    const char = buildCharacterFromWizardData({}, 'dnd5e');
    
    expect(char.name).toBe('');
    expect(char.level).toBe(1);
    expect(char.attributes.strength).toBe(10);
  });

  it('correctly syncs hp_current to hp_max', () => {
    const char = buildCharacterFromWizardData({ name: 'Bob', hp_max: 42 }, 'dnd5e');
    expect(char.hp_max).toBe(42);
    expect(char.hp_current).toBe(42);
  });

  it('non-d20 systems get ruleset attributes, not D&D fields', () => {
    const char = buildCharacterFromWizardData(
      { name: 'Dirk', cliche1: 4, cliche2: 3 },
      'risus',
      risus,
    );
    expect(char.name).toBe('Dirk');
    expect(char.attributes).toMatchObject({ cliche1: 4, cliche2: 3 });
    expect(char.attributes.strength).toBeUndefined();
    expect(char.ac).toBeUndefined();
    expect(char.hp_max).toBeUndefined();
    expect(char.speed).toBeUndefined();
    expect(char.type).toBe(ENTITY_TYPES.PC);
  });

  it('missing generic attribute values default to the attribute minimum', () => {
    const char = buildCharacterFromWizardData({ name: 'Min' }, 'risus', risus);
    expect(char.attributes.cliche1).toBe(0);
  });
});

describe('getWizardSteps', () => {
  it('dnd5e keeps its three D&D-shaped steps', () => {
    const steps = getWizardSteps('dnd5e');
    expect(steps).toHaveLength(3);
    expect(steps[2].fields.map((f) => f.key)).toContain('hp_max');
  });

  it('ruleset-driven systems never ask for HP Max or AC', () => {
    for (const [slug, rs] of [['risus', risus], ['fate', fate]]) {
      const keys = getWizardSteps(slug, rs).flatMap((s) => s.fields.map((f) => f.key));
      expect(keys, slug).not.toContain('hp_max');
      expect(keys, slug).not.toContain('ac');
    }
  });

  it('risus asks for its cliché dice with the ruleset labels', () => {
    const steps = getWizardSteps('risus', risus);
    const attrStep = steps.find((s) => s.id === 'attributes');
    expect(attrStep.fields.map((f) => f.key)).toEqual(risus.attributes.map((a) => a.key));
    expect(attrStep.fields[0].label).toBe('Cliché 1 dice');
    expect(attrStep.fields[0].type).toBe('int');
  });

  it('a missing ruleset degrades to a name-only wizard', () => {
    const steps = getWizardSteps('system-x', undefined);
    expect(steps.flatMap((s) => s.fields.map((f) => f.key))).toEqual(['name']);
  });
});
