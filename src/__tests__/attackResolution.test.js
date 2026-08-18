/**
 * resolveAttack - d20 vs AC attack automation
 *
 * resolveAttack() rolls 1d20 + attack_bonus, compares to target AC,
 * doubles damage dice on a crit, fumbles on a natural 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAttack } from '../ui/attack-modal.js';

function makeUi(attackerTokenId, targetTokenId, { attackerAC = 15, targetAC = 14 } = {}) {
  const attacker = { name: 'Fighter', ac: attackerAC, conditions: [] };
  const target   = { name: 'Goblin',  ac: targetAC,   conditions: [] };
  const tokens = new Map([
    [attackerTokenId, attacker],
    [targetTokenId,   target],
  ]);
  return {
    state: {
      tokens,
      settings: { systemConfig: { combat: { critThreshold: 20, fumbleThreshold: 1, defenseKey: 'ac' }, rolls: {} } },
      isGM: () => true,
    },
    diceRoller: {
      roll: vi.fn(),
    },
    mapRenderer: { applyDamage: vi.fn().mockResolvedValue({}) },
    toggleCombatAction: vi.fn().mockResolvedValue({}),
    _toast: vi.fn(),
    _log: vi.fn(),
    chat: { _send: vi.fn().mockResolvedValue({}) },
  };
}

describe('resolveAttack', () => {
  const ATK = 'atk1';
  const TGT = 'tgt1';

  afterEach(() => { vi.restoreAllMocks(); });

  it('shows a hit result when roll + bonus >= target AC', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 14 });
    // Roll 12, bonus +5 → total 17 ≥ AC 14
    ui.diceRoller.roll
      .mockReturnValueOnce({ rolls: [12], result: 17, modifier: 5 }) // attack
      .mockReturnValueOnce({ rolls: [6],  result: 8,  modifier: 2 }); // damage
    const container = document.createElement('div');
    await resolveAttack(ui, ATK, TGT, { name: 'Sword', attack_bonus: 5, damage: '1d6+2', damage_type: 'slashing' }, container);
    expect(container.innerHTML).toMatch(/hit/i);
  });

  it('shows a miss result when roll + bonus < target AC', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 18 });
    // Roll 5, bonus +3 → total 8 < AC 18
    ui.diceRoller.roll.mockReturnValueOnce({ rolls: [5], result: 8, modifier: 3 });
    const container = document.createElement('div');
    await resolveAttack(ui, ATK, TGT, { name: 'Sword', attack_bonus: 3, damage: '1d6' }, container);
    expect(container.innerHTML).toMatch(/miss/i);
  });

  it('doubles damage dice on a natural 20 critical hit', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 10 });
    // Natural 20 → crit → damage formula should be doubled
    ui.diceRoller.roll
      .mockReturnValueOnce({ rolls: [20], result: 25, modifier: 5 }) // attack
      .mockReturnValueOnce({ rolls: [8, 7], result: 15, modifier: 2 }); // damage
    const container = document.createElement('div');
    await resolveAttack(ui, ATK, TGT, { name: 'Dagger', attack_bonus: 5, damage: '1d6+2', damage_type: 'piercing' }, container);
    // Verify damage roll was called with doubled dice formula (2d6+2)
    const damageCall = ui.diceRoller.roll.mock.calls[1];
    expect(damageCall[0]).toBe('2d6+2');
    expect(container.innerHTML).toMatch(/critical/i);
  });

  it('doubles ALL dice pools in a complex damage formula on a crit', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 10 });
    ui.diceRoller.roll
      .mockReturnValueOnce({ rolls: [20], result: 25, modifier: 5 }) // attack
      .mockReturnValueOnce({ rolls: [4, 4, 3, 3], result: 11, modifier: 0 }); // damage
    const container = document.createElement('div');
    // Complex formula: 2d4 + 2d6 + 5
    await resolveAttack(ui, ATK, TGT, { name: 'Super Strike', attack_bonus: 5, damage: '2d4 + 2d6 + 5' }, container);
    const damageCall = ui.diceRoller.roll.mock.calls[1];
    expect(damageCall[0]).toBe('4d4 + 4d6 + 5');
  });

  it('shows a fumble on a natural 1 regardless of total', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 5 });
    // Natural 1 even with +20 bonus
    ui.diceRoller.roll.mockReturnValueOnce({ rolls: [1], result: 21, modifier: 20 });
    const container = document.createElement('div');
    await resolveAttack(ui, ATK, TGT, { name: 'Sword', attack_bonus: 20, damage: '1d6' }, container);
    expect(container.innerHTML).toMatch(/fumble/i);
  });

  it('sends attack result to chat', async () => {
    const ui = makeUi(ATK, TGT, { targetAC: 12 });
    ui.diceRoller.roll
      .mockReturnValueOnce({ rolls: [15], result: 18, modifier: 3 })
      .mockReturnValueOnce({ rolls: [5], result: 7, modifier: 2 });
    await resolveAttack(ui, ATK, TGT, { name: 'Axe', attack_bonus: 3, damage: '1d8+2' }, null);
    expect(ui.chat._send).toHaveBeenCalledWith(expect.stringContaining('Fighter'));
  });
});
