/**
 * F2: spell rendering reads school icons, level labels, and spell-slot
 * levels from the ruleset instead of hardcoded 5e tables.
 */

import { describe, it, expect } from 'vitest';
import {
  getSpellSchoolIcon,
  getSpellLevelLabel,
  getSpellGroupKey,
  getSpellSlotLevels,
} from '../ui/spells-ruleset.js';

const d5e = {
  spell_schools: [
    { key: 'Abjuration',  label: 'Abjuration',  icon: '🛡️' },
    { key: 'Evocation',   label: 'Evocation',   icon: '🔥' },
  ],
  spellcasting: {
    group_by: 'level',
    level_labels: { '0': 'Cantrips', '1': '1st Level', '2': '2nd Level' },
    slot_levels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
};

describe('getSpellSchoolIcon', () => {
  it('pulls from ruleset.spell_schools[].icon', () => {
    expect(getSpellSchoolIcon(d5e, 'Abjuration')).toBe('🛡️');
    expect(getSpellSchoolIcon(d5e, 'Evocation')).toBe('🔥');
  });

  it('falls back to 📖 for unknown schools', () => {
    expect(getSpellSchoolIcon(d5e, 'NoSuchSchool')).toBe('📖');
    expect(getSpellSchoolIcon({}, 'Abjuration')).toBe('📖');
  });
});

describe('getSpellLevelLabel', () => {
  it('pulls from ruleset.spellcasting.level_labels', () => {
    expect(getSpellLevelLabel(d5e, 0)).toBe('Cantrips');
    expect(getSpellLevelLabel(d5e, 1)).toBe('1st Level');
    expect(getSpellLevelLabel(d5e, 2)).toBe('2nd Level');
  });

  it('falls back to "Level N" for unlabelled levels', () => {
    expect(getSpellLevelLabel(d5e, 7)).toBe('Level 7');
    expect(getSpellLevelLabel({}, 3)).toBe('Level 3');
  });
});

describe('getSpellGroupKey', () => {
  it('reads the field named by ruleset.spellcasting.group_by', () => {
    expect(getSpellGroupKey(d5e, { level: 2, school: 'Evocation' })).toBe(2);
  });

  it('defaults to level when ruleset does not declare group_by', () => {
    expect(getSpellGroupKey({}, { level: 3 })).toBe(3);
  });

  it('supports custom grouping (e.g. school)', () => {
    const bySchool = { spellcasting: { group_by: 'school' } };
    expect(getSpellGroupKey(bySchool, { level: 2, school: 'Evocation' })).toBe('Evocation');
  });
});

describe('getSpellSlotLevels', () => {
  it('reads ruleset.spellcasting.slot_levels', () => {
    expect(getSpellSlotLevels(d5e)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('defaults to [] when ruleset has no slot system', () => {
    expect(getSpellSlotLevels({})).toEqual([]);
    expect(getSpellSlotLevels({ spellcasting: {} })).toEqual([]);
  });

  it('allows a custom slot shape (e.g. Warlock tiers 1..5)', () => {
    const warlock = { spellcasting: { slot_levels: [1, 2, 3, 4, 5] } };
    expect(getSpellSlotLevels(warlock)).toEqual([1, 2, 3, 4, 5]);
  });
});
