/**
 * Pure logic for the SRD compendium browser: name filtering, result
 * capping, id-collision suffixing, secondary-filter option lists, and
 * per-kind row summaries.
 */
import { describe, it, expect } from 'vitest';
import {
  capResults,
  resolveEntryId,
  crToNumber,
  distinctSpellLevels,
  distinctMonsterCRs,
  distinctItemTypes,
  spellSummary,
  monsterSummary,
  itemSummary,
} from '../ui/compendium/browse-helpers.js';

const SPELLS = [
  { id: 'srd-sp-fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation' },
  { id: 'srd-sp-fireball', name: 'Fireball', level: 3, school: 'Evocation' },
  { id: 'srd-sp-wish', name: 'Wish', level: 9, school: 'Conjuration' },
];

describe('capResults', () => {
  it('passes short lists through with no hidden count', () => {
    const { shown, hiddenCount } = capResults(SPELLS, 50);
    expect(shown.length).toBe(3);
    expect(hiddenCount).toBe(0);
  });

  it('caps long lists and reports how many were hidden', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ name: `e${i}` }));
    const { shown, hiddenCount } = capResults(many, 50);
    expect(shown.length).toBe(50);
    expect(hiddenCount).toBe(70);
    expect(shown[0].name).toBe('e0');
  });
});

describe('resolveEntryId', () => {
  it('keeps the base id when the collection has no entry for it', () => {
    expect(resolveEntryId('srd-sp-fireball', new Map())).toBe('srd-sp-fireball');
  });

  it('suffixes -2 when the base id is taken', () => {
    const existing = new Map([['srd-sp-fireball', {}]]);
    expect(resolveEntryId('srd-sp-fireball', existing)).toBe('srd-sp-fireball-2');
  });

  it('walks past taken suffixes', () => {
    const existing = new Map([
      ['srd-sp-fireball', {}],
      ['srd-sp-fireball-2', {}],
      ['srd-sp-fireball-3', {}],
    ]);
    expect(resolveEntryId('srd-sp-fireball', existing)).toBe('srd-sp-fireball-4');
  });
});

describe('crToNumber', () => {
  it('parses whole and fractional CR strings', () => {
    expect(crToNumber('5')).toBe(5);
    expect(crToNumber('1/4')).toBe(0.25);
    expect(crToNumber('1/8')).toBe(0.125);
    expect(crToNumber('0')).toBe(0);
  });
});

describe('secondary filter options', () => {
  it('distinctSpellLevels sorts numerically and dedupes', () => {
    expect(distinctSpellLevels(SPELLS)).toEqual([0, 3, 9]);
    expect(distinctSpellLevels([...SPELLS, { level: 3 }])).toEqual([0, 3, 9]);
  });

  it('distinctMonsterCRs sorts by numeric CR, fractions first', () => {
    const monsters = [{ cr: '10' }, { cr: '1/4' }, { cr: '2' }, { cr: '1/4' }];
    expect(distinctMonsterCRs(monsters)).toEqual(['1/4', '2', '10']);
  });

  it('distinctItemTypes sorts alphabetically and skips blanks', () => {
    const items = [{ type: 'Staff' }, { type: 'Armor' }, { type: 'Staff' }, {}];
    expect(distinctItemTypes(items)).toEqual(['Armor', 'Staff']);
  });
});

describe('row summaries', () => {
  it('spellSummary labels cantrips and leveled spells with school', () => {
    expect(spellSummary({ level: 0, school: 'Evocation' })).toBe('Cantrip · Evocation');
    expect(spellSummary({ level: 3, school: 'Evocation' })).toBe('Level 3 · Evocation');
  });

  it('monsterSummary shows CR and creature type', () => {
    expect(monsterSummary({ cr: '16', creature_type: 'Dragon' })).toBe('CR 16 · Dragon');
  });

  it('itemSummary shows type and rarity', () => {
    expect(itemSummary({ type: 'Staff', rarity: 'rare' })).toBe('Staff · rare');
  });

  it('summaries drop missing halves instead of printing blanks', () => {
    expect(spellSummary({ level: 2 })).toBe('Level 2');
    expect(monsterSummary({ cr: '1' })).toBe('CR 1');
    expect(itemSummary({ type: 'Wand' })).toBe('Wand');
    expect(itemSummary({})).toBe('');
  });
});
