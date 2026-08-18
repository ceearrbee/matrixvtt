/**
 * Per-turn action-economy toggles. The ruleset declares which action
 * slots exist (Action / Bonus Action / Reaction in 5e); this module
 * resets them for the incoming combatant and lets users tick them off.
 */

import { saveInitiative } from './persistence.js';

const DEFAULT_ACTIONS = [
  { key: 'action_used' },
  { key: 'bonus_action_used' },
  { key: 'reaction_used' },
];

/**
 * Wipe the action-use flags on an initiative entry so the incoming
 * combatant starts their turn with a fresh economy.
 */
export function resetCombatantActions(ui, entry) {
  const slots = ui.state.settings.systemConfig?.action_economy ?? DEFAULT_ACTIONS;
  for (const { key } of slots) entry[key] = false;
  entry.movement_used = 0;
}

/**
 * Flip the named action-use flag on the current combatant. Only the
 * active player (or GM) may toggle - other clients are observers.
 */
export async function toggleCombatAction(ui, type) {
  if (!ui._isMyCombatTurn() && !ui.state.isGM()) return;
  const entry = ui.state.initiative.order[ui.state.initiative.current_index];
  if (!entry) return;
  entry[type] = !entry[type];
  await saveInitiative(ui);
}
