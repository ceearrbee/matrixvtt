/**
 * The map Damage/Heal actions follow the ruleset's harm model. Stress
 * systems (Risus, FATE) tick boxes on the linked sheet and mirror the
 * track onto the token so the pip overlay updates; hp-pool systems
 * keep the existing hp_current math. Risus's all-1-capacity boxes take
 * N damage as N separate ticks ("lose three dice"); FATE's graduated
 * boxes keep the engine's capacity-fit semantics.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyDamage, applyHealing } from '../map/actions/combat.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';

function makeMr(systemConfig, { npc, token } = {}) {
  const theNpc = npc ?? { id: 'npc-1', name: 'Big Baddie', stress: [false, false, false, false, false, false] };
  const theToken = token ?? { id: 't1', name: 'Big Baddie', sheet_id: 'npc-1' };
  return /** @type {any} */ ({
    state: {
      settings: { systemConfig },
      tokens: new Map([['t1', theToken]]),
      characters: new Map(),
      npcs: new Map([['npc-1', theNpc]]),
      updateToken: vi.fn().mockResolvedValue(undefined),
      updateNPC: vi.fn().mockResolvedValue(undefined),
      updateCharacter: vi.fn().mockResolvedValue(undefined),
      sendRoomEvent: vi.fn().mockResolvedValue(undefined),
      widgetManager: { userId: '@gm:s' },
    },
  });
}

describe('applyDamage under a stress harm model (Risus)', () => {
  it('ticks one die lost on the sheet and mirrors it onto the token', async () => {
    const mr = makeMr(risus);
    await applyDamage(mr, 't1', 1);
    const npc = mr.state.updateNPC.mock.calls[0][1];
    expect(npc.stress).toEqual([true, false, false, false, false, false]);
    const token = mr.state.updateToken.mock.calls[0][1];
    expect(token.stress).toEqual([true, false, false, false, false, false]);
    expect(token.hp_current).toBeUndefined();
  });

  it('inappropriate-cliché damage of 3 ticks three boxes', async () => {
    const mr = makeMr(risus);
    await applyDamage(mr, 't1', 3);
    const npc = mr.state.updateNPC.mock.calls[0][1];
    expect(npc.stress.filter(Boolean)).toHaveLength(3);
  });

  it('healing clears ticked boxes', async () => {
    const mr = makeMr(risus, {
      npc: { id: 'npc-1', name: 'Big Baddie', stress: [true, true, true, false, false, false] },
    });
    await applyHealing(mr, 't1', 2);
    const npc = mr.state.updateNPC.mock.calls[0][1];
    expect(npc.stress.filter(Boolean)).toHaveLength(1);
  });
});

describe('applyDamage under an hp pool (d20)', () => {
  it('keeps the existing hp_current math', async () => {
    const mr = makeMr(dnd5e, {
      token: { id: 't1', name: 'Orc', hp_current: 10, hp_max: 15 },
    });
    await applyDamage(mr, 't1', 4);
    const token = mr.state.updateToken.mock.calls[0][1];
    expect(token.hp_current).toBe(6);
    expect(mr.state.updateNPC).not.toHaveBeenCalled();
  });
});
