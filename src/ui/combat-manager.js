/**
 * combat-manager - re-export facade for the combat module family.
 *
 * The real code lives in `src/ui/combat/`; this file exists so existing
 * call-sites (ui-methods, panels, tests) can keep importing from a
 * single path. Each sibling file stays well under the 300-LOC cap and
 * owns one slice of combat: turn navigation, initiative bookkeeping,
 * action economy, persistence.
 */

export { nextTurn, prevTurn, setTurn, endCombat, isMyCombatTurn } from './combat/turn-flow.js';
export { rollInitiative, rollMyInitiative } from './combat/start-combat.js';
export {
  getInitiativeMode,
  sortInitiativeOrder,
  addTokenToInitiative,
  removeFromInitiative,
  reorderInitiative,
  setInitiativeRoll,
} from './combat/initiative.js';
export { toggleCombatAction } from './combat/action-economy.js';
