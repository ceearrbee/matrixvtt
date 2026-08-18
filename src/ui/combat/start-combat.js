/**
 * Starting combat: builds the initial initiative order and prompts the
 * GM for a resolution mode when the ruleset is in individual mode.
 *
 * Kept separate from `initiative.js` so the in-combat mutation helpers
 * (add/remove/reorder) don't share a file with the 60-line modal prompt.
 */

import { h } from 'preact';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { MODAL_WIDTHS } from '../../utils/ui-constants.js';
import { INITIATIVE_MODES, DISPOSITIONS } from '../../utils/constants.js';
import { getInitiativeMode, sortInitiativeOrder } from './initiative.js';
import { saveInitiative } from './persistence.js';
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';

function tieBreakStat(ui) {
  return ui.state.settings?.systemConfig?.initiative?.tie_break_stat || null;
}

function sideOf(token) {
  return token?.disposition || DISPOSITIONS.NEUTRAL;
}

function sheetFor(ui, token) {
  if (!token?.sheet_id) return null;
  return ui.state.characters.get(token.sheet_id) || ui.state.npcs.get(token.sheet_id);
}

/**
 * Individual mode: one entry per token, initiative derived from a
 * per-token callback (which may return null so the player rolls later).
 */
function buildIndividualOrder(ui, rollFn) {
  const order = [];
  for (const [tokenId, token] of ui.state.tokens) {
    const sheet = sheetFor(ui, token);
    const bonus = sheet?.initiative_bonus || 0;
    const isPC = !!ui.state.characters.get(token.sheet_id);
    const initiative = rollFn({ tokenId, token, sheet, bonus, isPC });
    order.push({
      id: `init_${tokenId}_${Date.now()}`,
      character_id: token.sheet_id || tokenId,
      initiative,
      token_id: tokenId,
      name: token.name,
      hp_current: token.hp_current,
      hp_max: token.hp_max,
    });
  }
  return order;
}

/**
 * Side-based: one roll per disposition; all tokens on that side share
 * the roll. Tokens within a side are ordered by the ruleset tie-break.
 */
function buildSideOrder(ui, rollFor) {
  const sideRolls = {};
  const stat = tieBreakStat(ui);
  const order = [];
  for (const [tokenId, token] of ui.state.tokens) {
    const side = sideOf(token);
    if (sideRolls[side] === undefined) sideRolls[side] = rollFor(0);
    const sheet = sheetFor(ui, token);
    order.push({
      id: `init_${tokenId}_${Date.now()}`,
      character_id: token.sheet_id || tokenId,
      initiative: sideRolls[side],
      token_id: tokenId,
      name: token.name,
      hp_current: token.hp_current,
      hp_max: token.hp_max,
      side,
      _sheet_dex: sheet?.attributes?.[stat] ?? 10,
    });
  }
  return order;
}

/**
 * Static mode: no roll; rank tokens by the ruleset tie-break stat.
 */
function buildStaticOrder(ui) {
  const stat = tieBreakStat(ui);
  const order = [];
  for (const [tokenId, token] of ui.state.tokens) {
    const sheet = sheetFor(ui, token);
    order.push({
      id: `init_${tokenId}_${Date.now()}`,
      character_id: token.sheet_id || tokenId,
      initiative: sheet?.attributes?.[stat] ?? 10,
      token_id: tokenId,
      name: token.name,
      hp_current: token.hp_current,
      hp_max: token.hp_max,
    });
  }
  return order;
}

async function commitOrder(ui, order) {
  sortInitiativeOrder(ui, order);
  try {
    await ui.state.updateInitiative({ active: true, round: 1, current_index: 0, order });
  } catch (error) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to save initiative', error));
  }
  if (ui.chat) {
    await ui.chat.announceInitiativeOrder(order);
    await ui.chat.announceCombat(`Combat started! Round 1 - ${order[0]?.name ?? '-'}'s turn!`);
  }
}

function orderForResolutionMode(ui, resolution, rollFor) {
  if (resolution === INITIATIVE_MODES.SIDE)   return buildSideOrder(ui, rollFor);
  if (resolution === INITIATIVE_MODES.STATIC) return buildStaticOrder(ui);
  if (resolution === 'randomize')             return buildIndividualOrder(ui, ({ bonus }) => rollFor(bonus));
  if (resolution === 'players')               return buildIndividualOrder(ui, ({ bonus, isPC }) => (isPC ? null : rollFor(bonus)));
  // Fallback: manual - everyone starts at 0, GM types values in.
  return buildIndividualOrder(ui, () => 0);
}

function promptForResolutionMode(onPick) {
  openModal((close) => {
    const pick = (mode) => { close(); onPick(mode); };
    const btn = (mode, cls, text) => h('button', { type: 'button', class: cls, onClick: () => pick(mode) }, text);
    return h(Modal, { id: 'init-mode-modal', title: 'Start Combat', maxWidth: MODAL_WIDTHS.SMALL, onClose: close },
      h('div', null, [
        h('div', { style: 'margin-bottom:16px;' }, 'How should initiative be decided?'),
        h('div', { class: 'form-actions stack-md' }, [
          btn('randomize', 'dbt btn-primary', 'Randomize all'),
          btn('players', 'dbt', 'Players roll (NPCs auto-roll)'),
          btn('manual', 'dbt', 'Manual entry (all start at 0)'),
          btn('cancel', 'dbt', 'Cancel'),
        ]),
      ]));
  });
}

/**
 * GM entry point: start combat. Prompts for a resolution mode in
 * individual mode; side/static modes commit immediately.
 */
export async function rollInitiative(ui, mode) {
  if (ui.state.tokens.size === 0) {
    ui._toast('Place tokens on the map before starting combat', 'info');
    return;
  }

  const template = ui._getRollFormula('initiative');
  const rollFor = (bonus) =>
    ui.diceRoller.roll(ui._expandFormula(template, { bonus, mod: bonus, score: bonus })).result;

  const run = async (resolution) => {
    if (resolution === 'cancel') return;
    try {
      const order = orderForResolutionMode(ui, resolution, rollFor);
      await commitOrder(ui, order);
    } catch (e) {
      // The mode dialog has already closed by the time the rolls run;
      // a throw here would otherwise vanish as an unhandled rejection
      // and combat would silently fail to start.
      showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to start combat', e));
    }
  };

  if (mode) return run(mode);

  const resolveMode = getInitiativeMode(ui);
  if (resolveMode === INITIATIVE_MODES.SIDE || resolveMode === INITIATIVE_MODES.STATIC) {
    return run(resolveMode);
  }

  promptForResolutionMode(run);
}

/**
 * Player-facing: roll initiative for a token you own. Used when combat
 * started in "players roll" mode so each player fills their own slot.
 */
export async function rollMyInitiative(ui, tokenId) {
  const { active, order } = ui.state.initiative;
  if (!active) return;
  const idx = order.findIndex((entry) => entry.token_id === tokenId);
  if (idx === -1) return;

  const token = ui.state.tokens.get(tokenId);
  if (!token) return;
  if (!ui.state.isGM() && token.owner_user_id !== ui.state.widgetManager?.userId) return;

  const sheet = sheetFor(ui, token);
  const bonus = sheet?.initiative_bonus || 0;
  const template = ui._getRollFormula('initiative');
  const roll = ui.diceRoller.roll(ui._expandFormula(template, { bonus, mod: bonus, score: bonus })).result;

  const currentId = order[ui.state.initiative.current_index]?.id;
  order[idx].initiative = roll;
  sortInitiativeOrder(ui, order);
  const newIdx = order.findIndex((entry) => entry.id === currentId);
  ui.state.initiative.current_index = newIdx >= 0 ? newIdx : 0;

  await saveInitiative(ui);
  if (ui.chat) await ui.chat.announceMessage(`${token.name} rolled ${roll} for initiative!`);
}
