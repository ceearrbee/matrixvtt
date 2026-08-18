/**
 * play_actions source resolvers - pure functions that pull a list of
 * "actions a player can do right now" from a particular source on the
 * character / ruleset / collections. The play_actions section
 * dispatches to these per-group.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveCharacterActions,
  resolveSpellIds,
  resolveInventoryConsumables,
  resolveRulesetCommonActions,
  resolveGroup,
} from '../ui/play-actions/sources.js';

const sword = { id: 'itm-sword', name: 'Shortsword', kind: 'weapon' };
const potion = { id: 'itm-potion', name: 'Potion of Healing', kind: 'consumable', consumable: true, quantity: 3 };
const empty = { id: 'itm-empty', name: 'Empty Vial', kind: 'consumable', consumable: true, quantity: 0 };

const fireBolt = { id: 'sp-fb', name: 'Fire Bolt', level: 0 };
const mm = { id: 'sp-mm', name: 'Magic Missile', level: 1 };
const fb = { id: 'sp-fb3', name: 'Fireball', level: 3 };

function makeState({ items = [], spells = [] } = {}) {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    spells: new Map(spells.map((s) => [s.id, s])),
  };
}

describe('resolveCharacterActions', () => {
  const actions = [
    { name: 'Sneak Attack', attack_bonus: 7, damage: '1d6+4' },
    { name: 'Cunning Action', description: 'Dash/Disengage/Hide as bonus action.' },
    { name: 'Wild Swing',    damage: '1d8' },
  ];

  it('returns all actions when no filter is set', () => {
    const character = { actions };
    expect(resolveCharacterActions(character).length).toBe(3);
  });

  it('filter: "attack" keeps entries with attack_bonus OR damage', () => {
    const character = { actions };
    const result = resolveCharacterActions(character, { filter: 'attack' });
    expect(result.length).toBe(2);
    expect(result.map((a) => a.name)).toEqual(['Sneak Attack', 'Wild Swing']);
  });

  it('returns [] when character.actions is missing', () => {
    expect(resolveCharacterActions({})).toEqual([]);
  });
});

describe('resolveSpellIds', () => {
  it('maps spell_ids[] to spell records from state', () => {
    const character = { spell_ids: ['sp-fb', 'sp-mm'] };
    const state = makeState({ spells: [fireBolt, mm] });
    const result = resolveSpellIds(character, state);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Fire Bolt');
  });

  it('skips ids that resolve to nothing', () => {
    const character = { spell_ids: ['sp-fb', 'sp-missing'] };
    const state = makeState({ spells: [fireBolt] });
    expect(resolveSpellIds(character, state).length).toBe(1);
  });

  it('cantrips are always available (no slot gate)', () => {
    const character = { spell_ids: ['sp-fb'], spell_slots: {} };
    const state = makeState({ spells: [fireBolt] });
    const result = resolveSpellIds(character, state);
    expect(result[0].available).toBe(true);
  });

  it('leveled spells with available slots are available', () => {
    const character = { spell_ids: ['sp-mm'], spell_slots: { '1': { total: 4, used: 1 } } };
    const state = makeState({ spells: [mm] });
    const result = resolveSpellIds(character, state);
    expect(result[0].available).toBe(true);
  });

  it('leveled spells with no remaining slots are unavailable', () => {
    const character = { spell_ids: ['sp-mm'], spell_slots: { '1': { total: 4, used: 4 } } };
    const state = makeState({ spells: [mm] });
    const result = resolveSpellIds(character, state);
    expect(result[0].available).toBe(false);
  });
});

describe('resolveInventoryConsumables', () => {
  it('returns only consumable items from inventory_ids[]', () => {
    const character = { inventory_ids: ['itm-sword', 'itm-potion'] };
    const state = makeState({ items: [sword, potion] });
    const result = resolveInventoryConsumables(character, state);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Potion of Healing');
  });

  it('drops consumables with quantity <= 0', () => {
    const character = { inventory_ids: ['itm-empty', 'itm-potion'] };
    const state = makeState({ items: [empty, potion] });
    const result = resolveInventoryConsumables(character, state);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('itm-potion');
  });

  it('coalesces identical consumables: two separate stacks of the same item render as one entry with summed quantity', () => {
    // Real-world repro from the in-combat screenshot: a character had two
    // "Healing Potion × 1" stacks in inventory_ids → the play_actions Items
    // panel rendered two identical buttons. Coalesce by (name, description)
    // so the surface shows one button per distinct consumable.
    const potionStack1 = { id: 'itm-potion-1', name: 'Healing Potion', kind: 'consumable', consumable: true, quantity: 1 };
    const potionStack2 = { id: 'itm-potion-2', name: 'Healing Potion', kind: 'consumable', consumable: true, quantity: 1 };
    const character = { inventory_ids: ['itm-potion-1', 'itm-potion-2'] };
    const state = makeState({ items: [potionStack1, potionStack2] });
    const result = resolveInventoryConsumables(character, state);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Healing Potion');
    expect(result[0].quantity).toBe(2);
  });

  it('does NOT coalesce consumables with the same name but different descriptions', () => {
    const a = { id: 'a', name: 'Tonic', kind: 'consumable', consumable: true, quantity: 1, description: 'Heals 1d4' };
    const b = { id: 'b', name: 'Tonic', kind: 'consumable', consumable: true, quantity: 1, description: 'Cures poison' };
    const character = { inventory_ids: ['a', 'b'] };
    const state = makeState({ items: [a, b] });
    const result = resolveInventoryConsumables(character, state);
    expect(result.length).toBe(2);
  });
});

describe('resolveRulesetCommonActions', () => {
  it('returns the ruleset combat.common_actions array', () => {
    const ruleset = { combat: { common_actions: [{ label: 'Dodge' }, { label: 'Dash' }] } };
    expect(resolveRulesetCommonActions(ruleset).length).toBe(2);
  });

  it('returns [] when the ruleset has no common_actions', () => {
    expect(resolveRulesetCommonActions({})).toEqual([]);
    expect(resolveRulesetCommonActions(null)).toEqual([]);
  });
});

describe('resolveGroup (the dispatcher)', () => {
  const character = {
    actions: [{ name: 'Attack', attack_bonus: 5, damage: '1d8' }],
    spell_ids: ['sp-fb'],
    inventory_ids: ['itm-potion'],
  };
  const state = makeState({ spells: [fireBolt], items: [potion] });
  const ruleset = { combat: { common_actions: [{ label: 'Dodge' }] } };

  it('dispatches to the right source by name', () => {
    expect(resolveGroup({ source: 'character_actions' }, { character, state, ruleset }).length).toBe(1);
    expect(resolveGroup({ source: 'spell_ids' }, { character, state, ruleset }).length).toBe(1);
    expect(resolveGroup({ source: 'inventory_consumables' }, { character, state, ruleset }).length).toBe(1);
    expect(resolveGroup({ source: 'ruleset_common_actions' }, { character, state, ruleset }).length).toBe(1);
  });

  it('unknown source returns []', () => {
    expect(resolveGroup({ source: 'made_up' }, { character, state, ruleset })).toEqual([]);
  });
});
