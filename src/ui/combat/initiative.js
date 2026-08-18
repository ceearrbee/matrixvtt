/**
 * Initiative bookkeeping: sorting, adding/removing combatants,
 * re-ordering, and one-off entry edits. Starting combat lives in
 * `start-combat.js`; this file handles the in-combat mutations.
 */

import { INITIATIVE_MODES } from '../../utils/constants.js';
import { saveInitiative } from './persistence.js';

/**
 * Resolve the effective initiative mode for this session.
 * Priority: localStorage override → ruleset default → 'individual'.
 */
export function getInitiativeMode(ui) {
  try {
    const override = localStorage.getItem('vtt:initiative-mode-override');
    if (override && override !== 'auto') return override;
  } catch { /* localStorage may be blocked in widget context */ }
  return ui.state.settings?.systemConfig?.initiative?.mode || INITIATIVE_MODES.INDIVIDUAL;
}

function tieBreakStat(ui) {
  return ui.state.settings?.systemConfig?.initiative?.tie_break_stat || null;
}

/**
 * Sort an order array in-place by initiative (desc), breaking ties via
 * the ruleset-declared tie-break stat (also desc). No tie-break stat
 * ⇒ ties keep their insertion order.
 */
export function sortInitiativeOrder(ui, order) {
  const statKey = tieBreakStat(ui);
  if (!statKey) {
    return order.sort((a, b) => b.initiative - a.initiative);
  }
  const statFor = (entry) => {
    const sheet = ui.state.characters.get(entry.character_id) || ui.state.npcs.get(entry.character_id);
    return sheet?.attributes?.[statKey] ?? 10;
  };
  return order.sort((a, b) => (b.initiative - a.initiative) || (statFor(b) - statFor(a)));
}

/**
 * Add a token to an existing order (or start combat if no order yet).
 * Re-adding the same token replaces its entry instead of duplicating.
 */
export async function addTokenToInitiative(ui, tokenId) {
  const token = ui.state.tokens.get(tokenId);
  if (!token) return;

  const sheet = token.sheet_id ? (ui.state.characters.get(token.sheet_id) || ui.state.npcs.get(token.sheet_id)) : null;
  const bonus = sheet?.initiative_bonus || 0;
  const roll = Math.floor(Math.random() * 20) + 1 + bonus;

  const entry = {
    id: `init_${tokenId}_${Date.now()}`,
    character_id: token.sheet_id || tokenId,
    initiative: roll,
    token_id: tokenId,
    name: token.name,
    hp_current: token.hp_current,
    hp_max: token.hp_max,
  };

  if (!ui.state.initiative.active) {
    await ui.state.updateInitiative({ active: true, round: 1, current_index: 0, order: [entry] });
  } else {
    const idx = ui.state.initiative.order.findIndex((e) => e.token_id === tokenId);
    if (idx !== -1) ui.state.initiative.order[idx] = entry;
    else ui.state.initiative.order.push(entry);
    sortInitiativeOrder(ui, ui.state.initiative.order);
    await saveInitiative(ui);
  }
  if (ui.chat) await ui.chat.announceMessage(`${token.name} rolled ${roll} for initiative!`);
}

/**
 * GM action: remove a token from the order. Cleans up the current
 * index so turn tracking stays correct after the removal.
 */
export async function removeFromInitiative(ui, tokenId) {
  if (!ui.state.isGM()) return;
  const { order, current_index } = ui.state.initiative;
  const idx = order.findIndex((e) => e.token_id === tokenId);
  if (idx === -1) return;

  order.splice(idx, 1);
  if (idx < current_index) {
    ui.state.initiative.current_index = Math.max(0, current_index - 1);
  } else if (idx === current_index) {
    ui.state.initiative.current_index = order.length > 0 ? current_index % order.length : 0;
  }

  if (order.length === 0) {
    await ui.state.clearInitiative();
    return;
  }

  await saveInitiative(ui);
}

/**
 * Drag-and-drop reorder. Keeps `current_index` pointing at the same
 * combatant after the shuffle.
 */
export async function reorderInitiative(ui, fromIndex, toIndex) {
  const order = [...ui.state.initiative.order];
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);

  let newCurrent = ui.state.initiative.current_index;
  if (fromIndex === newCurrent) newCurrent = toIndex;
  else if (fromIndex < newCurrent && toIndex >= newCurrent) newCurrent--;
  else if (fromIndex > newCurrent && toIndex <= newCurrent) newCurrent++;

  ui.state.initiative.order = order;
  ui.state.initiative.current_index = newCurrent;
  await saveInitiative(ui);
}

/**
 * GM override: type a new initiative value into an existing entry. Resorts
 * the order and keeps the current pointer on the same combatant.
 */
export async function setInitiativeRoll(ui, index, rawValue) {
  if (!ui.state.isGM()) return;
  const value = parseInt(rawValue, 10);
  if (Number.isNaN(value)) return;

  const { order, current_index } = ui.state.initiative;
  const currentId = order[current_index]?.id;
  order[index].initiative = value;
  sortInitiativeOrder(ui, order);
  const newIdx = order.findIndex((e) => e.id === currentId);
  ui.state.initiative.current_index = newIdx >= 0 ? newIdx : 0;

  await saveInitiative(ui);
}
