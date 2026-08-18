/**
 * GM-only ±N HP cluster
 * on initiative rows. Routes through ui.adjustHP after resolving the
 * token's sheet to the right entity kind (PC vs NPC).
 */
import { describe, it, expect, vi } from 'vitest';
import { adjustTokenHP } from '../ui/gm/entity-ops.js';

function fakeUI({ token, character = null, npc = null, isGM = true } = {}) {
  const characters = new Map(character ? [[character.id, character]] : []);
  const npcs = new Map(npc ? [[npc.id, npc]] : []);
  const updates = [];
  return {
    updates,
    state: {
      isGM: () => isGM,
      canEditEntity: () => true,
      tokens: new Map([[token.id, token]]),
      characters,
      npcs,
      async updateCharacter(id, v) { updates.push({ kind: 'pc', id, hp: v.hp_current }); },
      async updateNPC(id, v) { updates.push({ kind: 'npc', id, hp: v.hp_current }); },
    },
    _toast: vi.fn(),
  };
}

describe('adjustTokenHP', () => {
  it('routes a PC token to updateCharacter', async () => {
    const ui = fakeUI({
      token: { id: 'tok-1', sheet_id: 'pc-1', name: 'Aria' },
      character: { id: 'pc-1', name: 'Aria', hp_current: 20, hp_max: 30 },
    });
    await adjustTokenHP(ui, 'tok-1', -5);
    expect(ui.updates).toEqual([{ kind: 'pc', id: 'pc-1', hp: 15 }]);
  });

  it('routes an NPC token to updateNPC', async () => {
    const ui = fakeUI({
      token: { id: 'tok-2', sheet_id: 'npc-1', name: 'Goblin' },
      npc: { id: 'npc-1', name: 'Goblin', hp_current: 8, hp_max: 8 },
    });
    await adjustTokenHP(ui, 'tok-2', -3);
    expect(ui.updates).toEqual([{ kind: 'npc', id: 'npc-1', hp: 5 }]);
  });

  it('clamps to 0 / hp_max', async () => {
    const ui = fakeUI({
      token: { id: 'tok-3', sheet_id: 'pc-3', name: 'Aria' },
      character: { id: 'pc-3', hp_current: 2, hp_max: 30 },
    });
    await adjustTokenHP(ui, 'tok-3', -100);
    expect(ui.updates.at(-1).hp).toBe(0);
  });
});
