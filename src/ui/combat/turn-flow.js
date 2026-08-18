/**
 * Turn navigation: advance to the next combatant, step backward, jump
 * to a specific slot, end combat, and query whether this client owns
 * the current turn.
 */

import { confirm } from '../confirm-dialogs.jsx';
import { tickConditionDurations } from '../../map/actions/combat.js';
import { getCombatSettings } from '../settings-helpers.js';
import { resetCombatantActions } from './action-economy.js';
import { saveInitiative } from './persistence.js';
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';

/**
 * Advance to the next combatant. Ticks durational conditions on the
 * outgoing token; announces the incoming name when chat is wired.
 */
export async function nextTurn(ui) {
  if (!ui.state.isGM() && !ui._isMyCombatTurn()) return;
  const { order, current_index, round } = ui.state.initiative;
  if (!order.length) return ui._toast('No initiative order', 'info');

  const newIndex = (current_index + 1) % order.length;
  const newRound = round + (newIndex === 0 ? 1 : 0);

  await tickOutgoingConditions(ui, order[current_index]);

  const incoming = order[newIndex];
  if (incoming) resetCombatantActions(ui, incoming);

  ui.state.initiative.current_index = newIndex;
  ui.state.initiative.round = newRound;

  await saveInitiative(ui);
  if (ui.chat) await ui.chat.announceTurn(newRound, incoming.name);
}

async function tickOutgoingConditions(ui, outgoing) {
  if (!outgoing) return;
  const token = ui.state.tokens.get(outgoing.token_id);
  if (!token) return;
  if (tickConditionDurations(token).length === 0) return;
  await ui.state.updateToken(outgoing.token_id, token).catch(showErrorNotification);
}

/**
 * Step backward one slot. GM only - undoing a turn mid-combat is a GM-
 * level correction, never a player action.
 */
export async function prevTurn(ui) {
  if (!ui.state.isGM()) return;
  const { order, current_index, round } = ui.state.initiative;
  if (!order.length) return;

  const newIndex = (current_index - 1 + order.length) % order.length;
  const newRound = Math.max(1, round - (current_index === 0 ? 1 : 0));

  ui.state.initiative.current_index = newIndex;
  ui.state.initiative.round = newRound;
  if (order[newIndex]) resetCombatantActions(ui, order[newIndex]);

  await saveInitiative(ui);
}

/**
 * Jump to an arbitrary slot. Announces the jump when auto-announce is on.
 */
export async function setTurn(ui, index) {
  if (!ui.state.isGM()) return;
  const { order, round } = ui.state.initiative;
  if (index < 0 || index >= order.length) return;

  ui.state.initiative.current_index = index;
  resetCombatantActions(ui, order[index]);

  await saveInitiative(ui);
  if (ui.chat && getCombatSettings().auto_announce_round) {
    await ui.chat.announceTurn(round, order[index].name);
  }
}

/**
 * GM action: confirm-then-clear the initiative order. Announces in
 * chat so players know combat has ended.
 */
export function endCombat(ui) {
  confirm('End combat and clear initiative?', async () => {
    try {
      await ui.state.clearInitiative();
    } catch (error) {
      showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to save initiative', error));
    }
    if (ui.chat) await ui.chat.announceCombat('Combat ended!');
  }, { title: 'End Combat', confirmText: 'End Combat', confirmClass: 'btn-primary' });
}

/**
 * Does the current turn belong to a token this user owns? Drives UI
 * affordances (the 'your turn' banner, per-player roll buttons).
 */
export function isMyCombatTurn(ui) {
  const { active, order, current_index } = ui.state.initiative;
  if (!active || !order?.length) return false;
  const token = ui.state.tokens.get(order[current_index]?.token_id);
  return token?.owner_user_id === ui.state.widgetManager?.userId;
}
