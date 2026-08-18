/**
 * Risus combat resolution: on your turn, rolling a cliché with an
 * enemy token selected resolves an opposed roll. The defender answers
 * with their best-named pool, both totals are announced, and the
 * loser's token takes one stress tick (a lost die) through the
 * harm-model damage path. Ties announce a reroll and tick nothing.
 * Only stress-model, slot-paired systems resolve this way; otherwise
 * the click stays a plain check roll.
 */
import { describe, it, expect, vi } from 'vitest';
import { opposedTargetFor, resolveOpposedRoll } from '../ui/combat/opposed-roll.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';

function makeUi(systemConfig = risus) {
  return /** @type {any} */ ({
    state: {
      settings: { systemConfig },
      initiative: {
        active: true, current_index: 0,
        order: [{ id: 'e1', token_id: 'tok-toast', name: 'Toast' }],
      },
      tokens: new Map([
        ['tok-toast', { id: 'tok-toast', name: 'Toast', sheet_id: 'chr-1' }],
        ['tok-bb', { id: 'tok-bb', name: 'Big Baddie', sheet_id: 'npc-1' }],
      ]),
      characters: new Map([['chr-1', {
        id: 'chr-1', name: 'Toast',
        cliches: { cliche1: 'YELL' }, attributes: { cliche1: 4 },
        stress: [false, false, false, false, false, false],
      }]]),
      npcs: new Map([['npc-1', {
        id: 'npc-1', name: 'Big Baddie',
        cliches: { cliche1: 'BITE', cliche2: 'GLARE' },
        attributes: { cliche1: 3, cliche2: 2 },
        stress: [false, false, false, false, false, false],
      }]]),
      selectedToken: 'tok-bb',
      updateToken: vi.fn().mockResolvedValue(undefined),
      updateNPC: vi.fn().mockResolvedValue(undefined),
      updateCharacter: vi.fn().mockResolvedValue(undefined),
    },
    _log: vi.fn(),
    chat: { announceMessage: vi.fn().mockResolvedValue(undefined) },
  });
}

describe('opposedTargetFor', () => {
  it('returns the selected enemy token during combat in a paired stress system', () => {
    expect(opposedTargetFor(makeUi())).toBe('tok-bb');
  });

  it('returns null when the selection is the current combatant', () => {
    const ui = makeUi();
    ui.state.selectedToken = 'tok-toast';
    expect(opposedTargetFor(ui)).toBeNull();
  });

  it('returns null outside combat, without a selection, or for d20 systems', () => {
    const noCombat = makeUi();
    noCombat.state.initiative.active = false;
    expect(opposedTargetFor(noCombat)).toBeNull();
    const noSelection = makeUi();
    noSelection.state.selectedToken = null;
    expect(opposedTargetFor(noSelection)).toBeNull();
    expect(opposedTargetFor(makeUi(dnd5e))).toBeNull();
  });
});

describe('resolveOpposedRoll', () => {
  const base = {
    attackerName: 'Toast', attackerLabel: 'YELL', attackerDice: 4,
    attackerTokenId: 'tok-toast', targetTokenId: 'tok-bb',
  };

  it('defender loses a die when the attacker rolls higher', async () => {
    const ui = makeUi();
    // rng 0.99 → every die is a 6; attacker 4d6=24 beats defender 3d6=18.
    await resolveOpposedRoll(ui, { ...base, rng: () => 0.99 });
    const npc = ui.state.updateNPC.mock.calls[0][1];
    expect(npc.stress.filter(Boolean)).toHaveLength(1);
    const announced = ui.chat.announceMessage.mock.calls[0][0];
    expect(announced).toContain('YELL');
    expect(announced).toContain('BITE');
    expect(announced).toContain('loses a die');
  });

  it('attacker loses a die when the defender rolls higher', async () => {
    const ui = makeUi();
    // Attacker pool of 1 vs defender 3: all dice roll 6.
    await resolveOpposedRoll(ui, { ...base, attackerDice: 1, rng: () => 0.99 });
    const char = ui.state.updateCharacter.mock.calls[0][1];
    expect(char.stress.filter(Boolean)).toHaveLength(1);
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
  });

  it('a tie announces a reroll and ticks nothing', async () => {
    const ui = makeUi();
    // Equal pools, constant dice → equal totals.
    ui.state.characters.get('chr-1').attributes.cliche1 = 3;
    await resolveOpposedRoll(ui, { ...base, attackerDice: 3, rng: () => 0.99 });
    expect(ui.state.updateNPC).not.toHaveBeenCalled();
    expect(ui.state.updateCharacter).not.toHaveBeenCalled();
    expect(ui.chat.announceMessage.mock.calls[0][0].toLowerCase()).toContain('tie');
  });

  it('uses the ruleset roll template, not hardcoded d6', async () => {
    const d10System = {
      ...risus,
      rolls: { ...risus.rolls, attribute: '{bonus}d10' },
    };
    const ui = makeUi(d10System);
    await resolveOpposedRoll(ui, { ...base, rng: () => 0.99 });
    const announced = ui.chat.announceMessage.mock.calls[0][0];
    expect(announced).toContain('4d10');
    expect(announced).toContain('3d10');
    expect(announced).not.toContain('d6');
  });

  it('an unrated defender takes an automatic hit, no fake 0-die roll', async () => {
    const ui = makeUi();
    ui.state.npcs.set('npc-1', {
      id: 'npc-1', name: 'Big Baddie', cliches: {}, attributes: {},
      stress: [false, false, false, false, false, false],
    });
    await resolveOpposedRoll(ui, { ...base, rng: () => 0.99 });
    const announced = ui.chat.announceMessage.mock.calls[0][0];
    expect(announced).toContain('no rated pools');
    expect(announced).not.toMatch(/0d\d/);
    const npc = ui.state.updateNPC.mock.calls[0][1];
    expect(npc.stress.filter(Boolean)).toHaveLength(1);
  });
});
