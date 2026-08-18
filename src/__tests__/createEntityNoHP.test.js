/**
 * Creating characters and NPCs must work in systems without HP. The
 * schemas hard-required hp_max, but the form only renders HP inputs
 * when the ruleset tracks HP, so in a Risus room Create NPC failed
 * validation against a field that wasn't in the DOM: applyFieldErrors
 * highlighted nothing, the modal sat there, and nothing was logged.
 */
import { describe, it, expect, vi } from 'vitest';
import { createNPC, updateNPC, createCharacter } from '../ui/entity/forms.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';

function makeModal(values = {}) {
  const modal = document.createElement('div');
  for (const [id, value] of Object.entries(values)) {
    const input = document.createElement('input');
    input.id = id;
    input.value = value;
    modal.appendChild(input);
  }
  return modal;
}

function makeUi(systemConfig) {
  return /** @type {any} */ ({
    state: {
      settings: { systemConfig },
      npcs: new Map(),
      characters: new Map(),
      updateNPC: vi.fn().mockResolvedValue(undefined),
      updateCharacter: vi.fn().mockResolvedValue(undefined),
    },
    widgetManager: { userId: '@gm:s' },
    _collectAttributeValues: () => ({ cliche1: 3 }),
    _collectSpellSlots: () => ({}),
  });
}

describe('createNPC without HP fields (Risus)', () => {
  it('creates the NPC from name alone', async () => {
    const ui = makeUi(risus);
    const ok = await createNPC(ui, makeModal({ 'entity-name': 'Big Baddie' }));
    expect(ok).toBe(true);
    expect(ui.state.updateNPC).toHaveBeenCalledOnce();
    const npc = ui.state.updateNPC.mock.calls[0][1];
    expect(npc.name).toBe('Big Baddie');
    expect(npc.hp_current).toBeUndefined();
    expect(Number.isNaN(npc.hp_current)).toBe(false);
  });

  it('still requires HP Max for systems that track HP', async () => {
    const ui = makeUi(dnd5e);
    const ok = await createNPC(ui, makeModal({ 'entity-name': 'Orc' }));
    expect(ok).toBe(false);
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
  });
});

describe('updateNPC without HP fields (Risus)', () => {
  it('saves without producing NaN hp_current', async () => {
    const ui = makeUi(risus);
    ui.state.npcs.set('npc-1', { id: 'npc-1', name: 'Old', stress: [false] });
    const ok = await updateNPC(ui, makeModal({ 'entity-name': 'Renamed' }), 'npc-1');
    expect(ok).toBe(true);
    const npc = ui.state.updateNPC.mock.calls[0][1];
    expect(npc.name).toBe('Renamed');
    expect(Number.isNaN(npc.hp_current)).toBe(false);
  });
});

describe('createCharacter without HP fields (Risus)', () => {
  it('creates the character from name alone', async () => {
    const ui = makeUi(risus);
    const ok = await createCharacter(ui, makeModal({ 'entity-name': 'Crumb' }));
    expect(ok).toBe(true);
    expect(ui.state.updateCharacter).toHaveBeenCalledOnce();
    expect(ui.state.updateCharacter.mock.calls[0][1].name).toBe('Crumb');
  });
});

describe('placeSheetOnMap stat inheritance', () => {
  it('does not stamp d20 defaults onto tokens for sheets without them', async () => {
    const { placeSheetOnMap } = await import('../ui/entity/placement.js');
    const updateToken = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();
    const ui = /** @type {any} */ ({
      state: {
        npcs: new Map([['npc-1', { id: 'npc-1', name: 'Big Baddie', attributes: { cliche1: 4 } }]]),
        characters: new Map(),
        tokens: new Map(),
        activeMapId: 'm1',
        map: { width_cells: 10, height_cells: 10 },
        updateToken,
      },
      widgetManager: { userId: '@gm:s' },
      _toast: toast,
    });
    await placeSheetOnMap(ui, 'npc-1', 'npc');
    const token = updateToken.mock.calls[0][1];
    expect(token.hp_max).toBeUndefined();
    expect(token.ac).toBeUndefined();
    expect(toast).toHaveBeenCalledWith('Big Baddie placed on map', 'success');
  });

  it('still copies hp and ac from sheets that have them', async () => {
    const { placeSheetOnMap } = await import('../ui/entity/placement.js');
    const updateToken = vi.fn().mockResolvedValue(undefined);
    const ui = /** @type {any} */ ({
      state: {
        npcs: new Map([['npc-2', { id: 'npc-2', name: 'Orc', hp_max: 15, ac: 13 }]]),
        characters: new Map(),
        tokens: new Map(),
        activeMapId: 'm1',
        map: { width_cells: 10, height_cells: 10 },
        updateToken,
      },
      widgetManager: { userId: '@gm:s' },
      _toast: vi.fn(),
    });
    await placeSheetOnMap(ui, 'npc-2', 'npc');
    const token = updateToken.mock.calls[0][1];
    expect(token.hp_max).toBe(15);
    expect(token.hp_current).toBe(15);
    expect(token.ac).toBe(13);
  });
});
