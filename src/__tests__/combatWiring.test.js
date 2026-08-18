/**
 * Combat & dice wiring - fourth extraction from ui-methods.js. Each
 * method forwards to combat-manager.js, dice-helpers.js, or attack-modal.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/combat-manager.js', () => ({
  nextTurn: vi.fn(),
  prevTurn: vi.fn(),
  setTurn: vi.fn(),
  rollInitiative: vi.fn(),
  rollMyInitiative: vi.fn(),
  addTokenToInitiative: vi.fn(),
  removeFromInitiative: vi.fn(),
  reorderInitiative: vi.fn(),
  endCombat: vi.fn(),
  isMyCombatTurn: vi.fn(() => true),
  toggleCombatAction: vi.fn(),
  setInitiativeRoll: vi.fn(),
}));
vi.mock('../ui/dice-helpers.js', () => ({
  handleDiceRoll: vi.fn(),
  rollAttributeCheck: vi.fn(),
  rollSkillCheck: vi.fn(),
  rollNPCAction: vi.fn(),
  expandFormula: vi.fn(),
  getRollFormula: vi.fn(),
  fireRoll: vi.fn(),
  fireAdvantageRoll: vi.fn(),
  fireDisadvantageRoll: vi.fn(),
  fireFormulaRoll: vi.fn(),
}));
vi.mock('../ui/attack-modal.js', () => ({ resolveAttack: vi.fn() }));

import { attachCombatMethods } from '../ui/combat-wiring.js';
import * as combat from '../ui/combat-manager.js';
import * as dice from '../ui/dice-helpers.js';
import * as attack from '../ui/attack-modal.js';

function makeUI() { return { _toast: vi.fn() }; }

describe('attachCombatMethods(ui)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('turn controls forward', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.nextTurn(); ui.prevTurn(); ui.setTurn(3); ui.endCombat();
    expect(combat.nextTurn).toHaveBeenCalledWith(ui);
    expect(combat.prevTurn).toHaveBeenCalledWith(ui);
    expect(combat.setTurn).toHaveBeenCalledWith(ui, 3);
    expect(combat.endCombat).toHaveBeenCalledWith(ui);
  });

  it('initiative methods forward', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.rollInitiative('all'); ui.rollMyInitiative('tok-1');
    ui.addTokenToInitiative('tok-2'); ui.removeFromInitiative('tok-3');
    ui.reorderInitiative(0, 2); ui.setInitiativeRoll(1, 15);
    expect(combat.rollInitiative).toHaveBeenCalledWith(ui, 'all');
    expect(combat.rollMyInitiative).toHaveBeenCalledWith(ui, 'tok-1');
    expect(combat.addTokenToInitiative).toHaveBeenCalledWith(ui, 'tok-2');
    expect(combat.removeFromInitiative).toHaveBeenCalledWith(ui, 'tok-3');
    expect(combat.reorderInitiative).toHaveBeenCalledWith(ui, 0, 2);
    expect(combat.setInitiativeRoll).toHaveBeenCalledWith(ui, 1, 15);
  });

  it('toggleCombatAction and _isMyCombatTurn forward', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.toggleCombatAction('reaction');
    expect(combat.toggleCombatAction).toHaveBeenCalledWith(ui, 'reaction');
    expect(ui._isMyCombatTurn()).toBe(true);
    expect(combat.isMyCombatTurn).toHaveBeenCalledWith(ui);
  });

  it('_resolveAttack forwards to attack-modal.resolveAttack', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui._resolveAttack('atk', 'tgt', { bonus: 2 }, { hit: true });
    expect(attack.resolveAttack).toHaveBeenCalledWith(ui, 'atk', 'tgt', { bonus: 2 }, { hit: true });
  });

  it('dice handlers forward', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.handleDiceRoll();
    ui.rollAttributeCheck('STR', 3);
    ui.rollSkillCheck('athletics', 5);
    ui.rollNPCAction('npc-1', 0);
    expect(dice.handleDiceRoll).toHaveBeenCalledWith(ui);
    expect(dice.rollAttributeCheck).toHaveBeenCalledWith(ui, 'STR', 3);
    expect(dice.rollSkillCheck).toHaveBeenCalledWith(ui, 'athletics', 5);
    expect(dice.rollNPCAction).toHaveBeenCalledWith(ui, 'npc-1', 0);
  });

  it('fire helpers forward with ui prefix', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui._fireRoll(20, 3, 'Check');
    ui._fireAdvantageRoll(2, 'Adv');
    ui._fireDisadvantageRoll(1, 'Dis');
    ui._fireFormulaRoll('1d8+2', 'Damage');
    ui._getRollFormula('attack');
    ui._expandFormula('1d6', { str: 2 });
    expect(dice.fireRoll).toHaveBeenCalledWith(ui, 20, 3, 'Check');
    expect(dice.fireAdvantageRoll).toHaveBeenCalledWith(ui, 2, 'Adv');
    expect(dice.fireDisadvantageRoll).toHaveBeenCalledWith(ui, 1, 'Dis');
    expect(dice.fireFormulaRoll).toHaveBeenCalledWith(ui, '1d8+2', 'Damage');
    expect(dice.getRollFormula).toHaveBeenCalledWith(ui, 'attack');
    expect(dice.expandFormula).toHaveBeenCalledWith(ui, '1d6', { str: 2 });
  });

  it('rollDice, rollWithAdvantage, rollWithDisadvantage use internal helpers', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.rollDice('d20');
    ui.rollWithAdvantage();
    ui.rollWithDisadvantage();
    ui.rollInitiativeDie(4);
    expect(dice.fireRoll).toHaveBeenCalledWith(ui, '20', 0);
    expect(dice.fireAdvantageRoll).toHaveBeenCalledWith(ui, 0);
    expect(dice.fireDisadvantageRoll).toHaveBeenCalledWith(ui, 0);
    expect(dice.fireRoll).toHaveBeenCalledWith(ui, 20, 4, 'Initiative');
  });

  it('rollMacro forwards only when formula present', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.rollMacro('');
    expect(dice.fireFormulaRoll).not.toHaveBeenCalled();
    ui.rollMacro('2d6');
    expect(dice.fireFormulaRoll).toHaveBeenCalledWith(ui, '2d6');
  });

  it('saveCurrentFormula shows an info toast', () => {
    const ui = makeUI(); attachCombatMethods(ui);
    ui.saveCurrentFormula();
    expect(ui._toast).toHaveBeenCalledWith(expect.any(String), 'info');
  });
});
