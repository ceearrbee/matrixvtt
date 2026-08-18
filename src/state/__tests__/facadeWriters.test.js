/**
 * StateManager facade writers - every VTT type now routes through Yjs
 * (post-1.1b). The facade methods on StateManager delegate to writer
 * modules; these tests verify the right Yjs collection receives the
 * write.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../StateManager.js';

function mkSM() {
  const widgetManager = {
    sendStateEvent: vi.fn(async () => 'evt-1'),
    userId: '@me:s',
    isStandalone: true,
  };
  const sm = new StateManager(widgetManager, null);
  sm.settings = { ...sm.settings, gm_user_ids: ['@me:s'] };
  sm.powerLevels = { users: { '@me:s': 50 } };
  return { sm, widgetManager };
}

function spyYMap(sm, field) {
  const target = sm.yjs[field];
  return {
    set: vi.spyOn(target, 'set'),
    del: vi.spyOn(target, 'delete'),
  };
}

describe('StateManager facade writers - keyed collections', () => {
  let sm;
  beforeEach(() => { ({ sm } = mkSM()); });

  it('updateCharacter / removeCharacter route through yjs.charactersMap', async () => {
    const s = spyYMap(sm, 'charactersMap');
    await sm.updateCharacter('chr-1', { id: 'chr-1', name: 'Aria' });
    expect(s.set).toHaveBeenCalledWith('chr-1', { id: 'chr-1', name: 'Aria' });
    await sm.removeCharacter('chr-1');
    expect(s.del).toHaveBeenCalledWith('chr-1');
  });

  it('updateNPC / removeNPC route through yjs.npcsMap', async () => {
    const s = spyYMap(sm, 'npcsMap');
    await sm.updateNPC('npc-1', { id: 'npc-1', name: 'Goblin' });
    expect(s.set).toHaveBeenCalledWith('npc-1', { id: 'npc-1', name: 'Goblin' });
    await sm.removeNPC('npc-1');
    expect(s.del).toHaveBeenCalledWith('npc-1');
  });

  it('updateItem / removeItem route through yjs.itemsMap', async () => {
    const s = spyYMap(sm, 'itemsMap');
    await sm.updateItem('itm-1', { id: 'itm-1', name: 'Sword' });
    expect(s.set).toHaveBeenCalledWith('itm-1', { id: 'itm-1', name: 'Sword' });
    await sm.removeItem('itm-1');
    expect(s.del).toHaveBeenCalledWith('itm-1');
  });

  it('updateSpell / removeSpell route through yjs.spellsMap', async () => {
    const s = spyYMap(sm, 'spellsMap');
    await sm.updateSpell('spl-1', { id: 'spl-1', name: 'Fireball' });
    expect(s.set).toHaveBeenCalledWith('spl-1', { id: 'spl-1', name: 'Fireball' });
    await sm.removeSpell('spl-1');
    expect(s.del).toHaveBeenCalledWith('spl-1');
  });

  it('updateHandout / removeHandout route through yjs.handoutsMap', async () => {
    const s = spyYMap(sm, 'handoutsMap');
    await sm.updateHandout('h-1', { id: 'h-1', title: 'Note' });
    expect(s.set).toHaveBeenCalledWith('h-1', { id: 'h-1', title: 'Note' });
    await sm.removeHandout('h-1');
    expect(s.del).toHaveBeenCalledWith('h-1');
  });

  it('updateTable / removeTable route through yjs.tablesMap', async () => {
    const s = spyYMap(sm, 'tablesMap');
    await sm.updateTable('tbl-1', { id: 'tbl-1', name: 'Loot' });
    expect(s.set).toHaveBeenCalledWith('tbl-1', { id: 'tbl-1', name: 'Loot' });
    await sm.removeTable('tbl-1');
    expect(s.del).toHaveBeenCalledWith('tbl-1');
  });
});

describe('StateManager facade writers - singletons', () => {
  let sm;
  beforeEach(() => { ({ sm } = mkSM()); });

  it('updateSettings routes through yjs.settingsMap and strips systemConfig', async () => {
    const s = spyYMap(sm, 'settingsMap');
    const next = { gm_user_ids: ['@gm:s'], name: 'New', system: 'dnd5e', grid_px: 40, systemConfig: {} };
    await sm.updateSettings(next);
    const persisted = s.set.mock.calls[0][1];
    expect(persisted.systemConfig).toBeUndefined();
    expect(persisted.name).toBe('New');
  });

  it('updateInitiative routes through yjs.initiativeMap', async () => {
    const s = spyYMap(sm, 'initiativeMap');
    const init = { active: true, round: 2, current_index: 1, order: [{ token_id: 't-1' }] };
    await sm.updateInitiative(init);
    expect(s.set).toHaveBeenCalledWith('', init);
  });

  it('clearInitiative writes the canonical empty state via yjs.initiativeMap', async () => {
    const s = spyYMap(sm, 'initiativeMap');
    await sm.clearInitiative();
    expect(s.set).toHaveBeenCalledWith('', { active: false, round: 0, current_index: 0, order: [] });
  });

  it('setActiveMap merges active_map_id and writes via yjs.settingsMap', async () => {
    const s = spyYMap(sm, 'settingsMap');
    sm.settings = { gm_user_ids: ['@me:s'], name: 'S', system: 'generic', grid_px: 40 };
    await sm.setActiveMap('map-42');
    expect(s.set.mock.calls[0][1]).toEqual(
      expect.objectContaining({ active_map_id: 'map-42' })
    );
  });
});
