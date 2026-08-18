/**
 * bulk-ops.js - multi-token mutations the GM triggers with a confirm
 * modal. Each builds immutable clones of every affected token up
 * front, then drives sequential writes with a rate-limit pacer so
 * the queue has time to drain between events.
 */

import { h } from 'preact';
import { confirmAsync } from '../confirm-dialogs.jsx';
import { logger } from '../../utils/logger.js';

const RATE_LIMIT_DELAY_MS = 100;

function _denyIfNotGM(ui, actionLabel, toastMsg) {
  if (ui.state.isGM()) return false;
  logger.error('UI', `Permission denied - ${actionLabel}`);
  ui._toast(toastMsg);
  return true;
}

/**
 * Populate sm.tokens with the bulk-computed next state so the signal
 * republish paints everything at once; pace the sync traffic through
 * the facade sequentially. ReactiveMap `.set` publishes on every
 * write, so the accumulated paint is consistent before the network
 * round-trips begin.
 */
function _optimisticallyApplyTokens(ui, nextTokens) {
  for (const [id, token] of nextTokens) {
    ui.state.tokens.set(id, token);
  }
}

async function _writeTokensSequentially(ui, nextTokens) {
  for (const [tokenId, token] of nextTokens) {
    await ui.state.updateToken(tokenId, token);
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }
}

export async function healAll(ui) {
  if (_denyIfNotGM(ui, 'only GM can heal all tokens', 'Healing all tokens is a GM action. Ask a GM in this room.')) return;
  const tokenCount = ui.state.tokens.size;

  confirmAsync(
    h('span', null, ['Heal all ', h('strong', null, String(tokenCount)), ` token${tokenCount !== 1 ? 's' : ''} to maximum HP?`]),
    async () => {
      const healedTokens = new Map();
      for (const [id, token] of ui.state.tokens) {
        healedTokens.set(id, { ...token, hp_current: token.hp_max });
      }
      const healedInitiative = ui.state.initiative.active
        ? {
            ...ui.state.initiative,
            order: ui.state.initiative.order.map((entry) => {
              const token = healedTokens.get(entry.token_id);
              return token
                ? { ...entry, hp_current: token.hp_max, hp_max: token.hp_max }
                : entry;
            }),
          }
        : null;

      _optimisticallyApplyTokens(ui, healedTokens);
      if (healedInitiative) ui.state.initiative = healedInitiative;
      await _writeTokensSequentially(ui, healedTokens);
      if (healedInitiative) {
        await ui.state.updateInitiative(healedInitiative);
      }
    },
    { title: 'Heal All', confirmText: 'Heal All', busyText: 'Healing…', confirmClass: 'btn-primary' }
  );
}

export async function clearAllConditions(ui) {
  if (_denyIfNotGM(ui, 'only GM can clear all conditions', 'Clearing all conditions is a GM action. Ask a GM in this room.')) return;
  const affectedCount = Array.from(ui.state.tokens.values())
    .filter(t => t.conditions.length > 0).length;

  confirmAsync(
    h('span', null, [
      'Clear all conditions from all tokens?',
      h('br', null),
      h('small', { style: 'color: var(--color-text-secondary);' }, `${affectedCount} token${affectedCount !== 1 ? 's' : ''} with conditions`),
    ]),
    async () => {
      const cleared = new Map();
      for (const [id, token] of ui.state.tokens) {
        cleared.set(id, { ...token, conditions: [] });
      }
      _optimisticallyApplyTokens(ui, cleared);
      await _writeTokensSequentially(ui, cleared);
    },
    { title: 'Clear All Conditions', confirmText: 'Clear All', busyText: 'Clearing…', confirmClass: 'btn-primary' }
  );
}
