/**
 * Per-type item card sections: notes / potions / armor must not share
 * the weapon section list. Ruleset declares `item_kinds[<type>].sections`; the helper picks
 * that when present, falls back to `item_card.sections` otherwise.
 */
import { describe, it, expect } from 'vitest';
import { getItemSections } from '../ui/item-card-sections.js';

const ruleset = {
  item_card: {
    sections: [
      { kind: 'badge', field: 'rarity' },
      { kind: 'attack_line' },
      { kind: 'description' },
      { kind: 'stat_row' },
    ],
  },
  item_kinds: {
    note: {
      sections: [{ kind: 'description' }],
    },
    consumable: {
      sections: [{ kind: 'description' }, { kind: 'use_consumable' }],
    },
  },
};

describe('getItemSections - per-type dispatch', () => {
  it('returns the per-type sections when item.type matches a kind', () => {
    expect(getItemSections(ruleset, { type: 'note' })).toEqual([
      { kind: 'description' },
    ]);
  });

  it('is case-insensitive on item.type', () => {
    expect(getItemSections(ruleset, { type: 'Note' }))
      .toEqual([{ kind: 'description' }]);
    expect(getItemSections(ruleset, { type: 'CONSUMABLE' }))
      .toEqual([{ kind: 'description' }, { kind: 'use_consumable' }]);
  });

  it('trims whitespace on item.type', () => {
    expect(getItemSections(ruleset, { type: '  note  ' }))
      .toEqual([{ kind: 'description' }]);
  });

  it('falls back to item_card.sections when item.type has no dedicated block', () => {
    expect(getItemSections(ruleset, { type: 'weapon' })).toEqual(
      ruleset.item_card.sections,
    );
  });

  it('falls back when item.type is empty / undefined / null', () => {
    expect(getItemSections(ruleset, { type: '' })).toEqual(ruleset.item_card.sections);
    expect(getItemSections(ruleset, { type: null })).toEqual(ruleset.item_card.sections);
    expect(getItemSections(ruleset, {})).toEqual(ruleset.item_card.sections);
  });

  it('returns empty when ruleset is null and there is nothing to dispatch from', () => {
    expect(getItemSections(null, { type: 'note' })).toEqual([]);
    expect(getItemSections(undefined, { type: 'note' })).toEqual([]);
  });

  it('returns empty when ruleset has neither item_kinds nor item_card', () => {
    expect(getItemSections({}, { type: 'note' })).toEqual([]);
  });
});
