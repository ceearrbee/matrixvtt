import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/child-entity-crud.js', () => ({
  saveChildEntity: vi.fn(async () => true),
}));
vi.mock('../ui/ruleset-io.js', () => ({
  applyRulesetConfig: vi.fn(async () => true),
}));

import { LIBRARY_KINDS } from '../ui/library/kinds.js';
import { saveChildEntity } from '../ui/child-entity-crud.js';
import { applyRulesetConfig } from '../ui/ruleset-io.js';
import { EVENT_TYPES, LIBRARY_KIND } from '../utils/constants.js';

function stubUi({ isGM = true, character = null } = {}) {
  return {
    _toast: vi.fn(),
    state: {
      characters: new Map(),
      npcs: new Map(),
      items: new Map(),
      spells: new Map(),
      isGM: () => isGM,
      getCurrentCharacter: () => character,
      getCurrentCharacterId: () => (character ? character.id : null),
      createMap: vi.fn(async () => 'map-1'),
      settings: {},
    },
  };
}

beforeEach(() => {
  saveChildEntity.mockClear();
  applyRulesetConfig.mockClear();
});

describe('LIBRARY_KINDS insert', () => {
  it('has an entry for every library kind', () => {
    expect(Object.keys(LIBRARY_KINDS).sort()).toEqual(Object.values(LIBRARY_KIND).sort());
  });

  it('inserts an npc via saveChildEntity with a fresh id', async () => {
    const ui = stubUi();
    ui.state.npcs.set('lib-npc-1', {});
    const entry = { id: 'lib-npc-1', kind: 'npc', name: 'Goblin', data: { name: 'Goblin', hp: 7 } };
    await LIBRARY_KINDS.npc.insert(ui, entry);
    const call = saveChildEntity.mock.calls[0][1];
    expect(call.eventType).toBe(EVENT_TYPES.NPC);
    expect(call.id).not.toBe('lib-npc-1');
    expect(call.entity).toMatchObject({ name: 'Goblin', hp: 7 });
  });

  it('inserts a loose item for a GM', async () => {
    const ui = stubUi({ isGM: true });
    const entry = { id: 'x', kind: 'item', name: 'Rope', data: { name: 'Rope' } };
    await LIBRARY_KINDS.item.insert(ui, entry);
    expect(saveChildEntity.mock.calls[0][1].eventType).toBe(EVENT_TYPES.ITEM);
  });

  it('requires a character to insert a spell', async () => {
    const ui = stubUi({ isGM: false, character: null });
    const entry = { id: 'x', kind: 'spell', name: 'Bolt', data: { name: 'Bolt' } };
    const ok = await LIBRARY_KINDS.spell.insert(ui, entry);
    expect(ok).toBe(false);
    expect(saveChildEntity).not.toHaveBeenCalled();
  });

  it('applies a ruleset config on insert', async () => {
    const ui = stubUi();
    const entry = {
      id: 'x', kind: 'ruleset', name: 'FATE',
      data: { system: 'fate', name: 'FATE', attributes: [] },
    };
    await LIBRARY_KINDS.ruleset.insert(ui, entry);
    expect(applyRulesetConfig).toHaveBeenCalledWith(ui, 'fate', { name: 'FATE', attributes: [] });
  });

  it('creates a map via state.createMap without a stale id', async () => {
    const ui = stubUi();
    const entry = { id: 'x', kind: 'map', name: 'Cave', data: { id: 'old', name: 'Cave', image_url: 'mxc://a' } };
    await LIBRARY_KINDS.map.insert(ui, entry);
    const config = ui.state.createMap.mock.calls[0][0];
    expect(config.id).toBeUndefined();
    expect(config).toMatchObject({ name: 'Cave', image_url: 'mxc://a' });
  });
});
