/**
 * castSpell should be one-click complete: deduct the slot, roll
 * damage when the spell has a structured `damage` field, announce
 * the save DC when it has a `save_ability` field. Mirrors what the
 * three separate buttons on the spell preview do - but in one shot
 * for the play_actions surface so combat play doesn't require
 * three clicks per spell.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { castSpell } from '../ui/preview/preview-modals.js';

beforeEach(() => { document.body.innerHTML = ''; });

function makeUi({ spell, caster, rollListener = vi.fn() }) {
  const spells = new Map([[spell.id, spell]]);
  const characters = new Map();
  if (caster) characters.set(caster.id, caster);
  return {
    state: {
      spells,
      characters,
      settings: { systemConfig: { rolls: { attack: '1d20+{bonus}', skill: '1d20+{bonus}' } } },
      getCurrentCharacter: () => caster,
      updateCharacter: vi.fn().mockResolvedValue(true),
      sendRoomEvent: vi.fn().mockResolvedValue(undefined),
    },
    _log: vi.fn(),
    _toast: vi.fn(),
    _secretRoll: false,
    diceRoller: { roll: (f) => { rollListener(f); return { formula: f, rolls: [], modifier: 0, result: 0 }; } },
    chat: { announceMessage: vi.fn() },
  };
}

describe('castSpell - one-click complete', () => {
  it('deducts a slot for leveled spells', async () => {
    const spell = { id: 'sp-mm', name: 'Magic Missile', level: 1, damage: '3d4+3' };
    const caster = { id: 'c1', name: 'Sora', spell_slots: { '1': { total: 4, used: 1 } } };
    const ui = makeUi({ spell, caster });
    await castSpell(ui, 'sp-mm', 'c1');
    expect(ui.state.updateCharacter).toHaveBeenCalledWith('c1', expect.objectContaining({
      spell_slots: { '1': { total: 4, used: 2 } },
    }));
  });

  it('cantrips do not deduct a slot', async () => {
    const spell = { id: 'sp-fb', name: 'Fire Bolt', level: 0, damage: '1d10' };
    const caster = { id: 'c1', name: 'Sora', spell_slots: {} };
    const ui = makeUi({ spell, caster });
    await castSpell(ui, 'sp-fb', 'c1');
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
  });

  it('rolls damage when the spell has a structured damage field', async () => {
    const rollListener = vi.fn();
    const spell = { id: 'sp-fr', name: 'Fireball', level: 3, damage: '8d6', damage_type: 'fire', save_ability: 'dex' };
    const caster = { id: 'c1', name: 'Sora', spell_slots: { '3': { total: 2, used: 0 } } };
    const ui = makeUi({ spell, caster, rollListener });
    await castSpell(ui, 'sp-fr', 'c1');
    expect(rollListener).toHaveBeenCalledWith('8d6');
  });

  it('announces the save DC when the spell has a save_ability', async () => {
    const spell = { id: 'sp-fr', name: 'Fireball', level: 3, damage: '8d6', save_ability: 'dex' };
    const caster = { id: 'c1', name: 'Sora', spell_save_dc: 15, spell_slots: { '3': { total: 2, used: 0 } } };
    const ui = makeUi({ spell, caster });
    await castSpell(ui, 'sp-fr', 'c1');
    // The save announcement lands in the log
    const logCalls = ui._log.mock.calls.map((c) => c.join(' '));
    expect(logCalls.some((c) => /DC 15/i.test(c) && /DEX/i.test(c))).toBe(true);
  });

  it('skips damage roll when the spell has none (e.g., utility cantrip)', async () => {
    const rollListener = vi.fn();
    const spell = { id: 'sp-ms', name: 'Misty Step', level: 2 };
    const caster = { id: 'c1', name: 'Sora', spell_slots: { '2': { total: 3, used: 0 } } };
    const ui = makeUi({ spell, caster, rollListener });
    await castSpell(ui, 'sp-ms', 'c1');
    expect(rollListener).not.toHaveBeenCalled();
  });

  it('no remaining slots → cast fails, no slot deduction, no roll', async () => {
    const rollListener = vi.fn();
    const spell = { id: 'sp-fr', name: 'Fireball', level: 3, damage: '8d6' };
    const caster = { id: 'c1', name: 'Sora', spell_slots: { '3': { total: 2, used: 2 } } };
    const ui = makeUi({ spell, caster, rollListener });
    await castSpell(ui, 'sp-fr', 'c1');
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
    expect(rollListener).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalled();
  });
});
