
import {
  nextTurn as nextTurnFn,
  prevTurn as prevTurnFn,
  setTurn as setTurnFn,
  rollInitiative as rollInitiativeFn,
  rollMyInitiative as rollMyInitiativeFn,
  addTokenToInitiative as addTokenToInitiativeFn,
  removeFromInitiative as removeFromInitiativeFn,
  reorderInitiative as reorderInitiativeFn,
  endCombat as endCombatFn,
  isMyCombatTurn,
  toggleCombatAction as toggleCombatActionFn,
  setInitiativeRoll as setInitiativeRollFn,
} from './combat-manager.js';
import {
  handleDiceRoll as handleDiceRollFn,
  rollAttributeCheck as rollAttributeCheckFn,
  rollSkillCheck as rollSkillCheckFn,
  rollNPCAction as rollNPCActionFn,
  expandFormula,
  getRollFormula,
  fireRoll,
  fireAdvantageRoll,
  fireDisadvantageRoll,
  fireFormulaRoll,
} from './dice-helpers.js';
import { resolveAttack } from './attack-modal.js';

export function attachCombatMethods(ui) {
  // Turn / initiative controls
  ui.nextTurn = () => nextTurnFn(ui);
  ui.prevTurn = () => prevTurnFn(ui);
  ui.setTurn = (idx) => setTurnFn(ui, idx);
  ui.rollInitiative = (mode) => rollInitiativeFn(ui, mode);
  ui.rollMyInitiative = (tokenId) => rollMyInitiativeFn(ui, tokenId);
  ui.rollInitiativeDie = (bonus) => fireRoll(ui, 20, bonus, 'Initiative');
  ui.endCombat = () => endCombatFn(ui);
  ui.toggleCombatAction = (type) => toggleCombatActionFn(ui, type);
  ui.removeFromInitiative = (id) => removeFromInitiativeFn(ui, id);
  ui.setInitiativeRoll = (idx, val) => setInitiativeRollFn(ui, idx, val);
  ui.reorderInitiative = (f, t) => reorderInitiativeFn(ui, f, t);
  ui._resolveAttack = (aid, tid, data, res) => resolveAttack(ui, aid, tid, data, res);
  ui.addTokenToInitiative = (id) => addTokenToInitiativeFn(ui, id);
  ui._isMyCombatTurn = () => isMyCombatTurn(ui);

  // Dice - high-level check / action rolls
  ui.handleDiceRoll = () => handleDiceRollFn(ui);
  ui.rollAttributeCheck = (l, v) => rollAttributeCheckFn(ui, l, v);
  ui.rollSkillCheck = (s, b) => rollSkillCheckFn(ui, s, b);
  ui.rollNPCAction = (id, idx) => rollNPCActionFn(ui, id, idx);

  // Dice - quick-roll surface on the dice toolbar
  ui.rollDice = (d) => fireRoll(ui, d.substring(1), 0);
  ui.rollWithAdvantage = () => fireAdvantageRoll(ui, 0);
  ui.rollWithDisadvantage = () => fireDisadvantageRoll(ui, 0);
  ui.saveCurrentFormula = () =>
    ui._toast('Saving custom dice macros isn\'t implemented yet', 'info');
  ui.rollMacro = (f) => { if (f) fireFormulaRoll(ui, f); };

  ui._getRollFormula = (type) => getRollFormula(ui, type);
  ui._expandFormula = (tmpl, ctx) => expandFormula(ui, tmpl, ctx);
  ui._fireRoll = (s, m, l) => fireRoll(ui, s, m, l);
  ui._fireAdvantageRoll = (m, l) => fireAdvantageRoll(ui, m, l);
  ui._fireDisadvantageRoll = (m, l) => fireDisadvantageRoll(ui, m, l);
  ui._fireFormulaRoll = (f, l) => fireFormulaRoll(ui, f, l);
}
