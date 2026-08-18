/**
 * GM assigns / releases control of an NPC to a player. Sets the
 * `controlled_by` field so the controlling player sees the creature in
 * their Party roster (summons / familiars / henchmen).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignNPCController, releaseNPCController } from '../ui/entity/ownership.js';

function mkUi({ isGM = true } = {}) {
  const npc = { id: 'npc-fam', name: 'Familiar', type: 'npc', hp_max: 5, hp_current: 5 };
  return {
    state: {
      isGM: () => isGM,
      npcs: new Map([['npc-fam', npc]]),
      updateNPC: vi.fn(async () => {}),
    },
    _toast: vi.fn(),
  };
}

describe('assignNPCController', () => {
  let ui;
  beforeEach(() => { ui = mkUi(); });

  it('sets controlled_by to the target user', async () => {
    await assignNPCController(ui, 'npc-fam', '@player:s');
    expect(ui.state.updateNPC).toHaveBeenCalledWith('npc-fam',
      expect.objectContaining({ id: 'npc-fam', controlled_by: '@player:s' }));
  });

  it('is a no-op for non-GMs (only the GM assigns control)', async () => {
    ui = mkUi({ isGM: false });
    await assignNPCController(ui, 'npc-fam', '@player:s');
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
  });

  it('no-ops on an unknown npc id', async () => {
    await assignNPCController(ui, 'nope', '@player:s');
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
  });
});

describe('releaseNPCController', () => {
  it('clears controlled_by to null', async () => {
    const ui = mkUi();
    ui.state.npcs.get('npc-fam').controlled_by = '@player:s';
    await releaseNPCController(ui, 'npc-fam');
    expect(ui.state.updateNPC).toHaveBeenCalledWith('npc-fam',
      expect.objectContaining({ controlled_by: null }));
  });
});
