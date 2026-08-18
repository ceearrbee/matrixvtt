/**
 * display-name.js - Matrix-side display-name synchronisation.
 *
 * When the player claims a character or gains GM status, push an
 * updated display name like "Aria (alice)" as a per-room member event;
 * the account-wide profile name and avatar stay untouched. Debounced so
 * rapid claim/unclaim flows don't thrash.
 */

import { ENTITY_TYPES } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

const DEBOUNCE_MS = 600;

export function syncDisplayName(ui) {
  if (typeof ui.widgetManager.setDisplayName !== 'function') return;
  clearTimeout(ui._syncDisplayNameTimer);
  ui._syncDisplayNameTimer = setTimeout(() => doSyncDisplayName(ui), DEBOUNCE_MS);
}

async function doSyncDisplayName(ui) {
  if (typeof ui.widgetManager.setDisplayName !== 'function') return;
  const userId = ui.widgetManager.userId;
  if (!userId) return;

  const localpart = userId.match(/^@([^:]+):/)?.[1] ?? userId;

  const claimed = Array.from(ui.state.characters.values())
    .find((c) => c.type === ENTITY_TYPES.PC && c.claimed_by_user_id === userId);

  let desiredName;
  if (claimed) desiredName = `${claimed.name} (${localpart})`;
  else if (ui.state.isGM()) desiredName = `GM (${localpart})`;
  else return;

  if (desiredName === ui._lastSetDisplayName) return;

  try {
    await ui.widgetManager.setDisplayName(desiredName);
    ui._lastSetDisplayName = desiredName;

    if (Array.isArray(ui.state.roomMembers)) {
      const member = ui.state.roomMembers.find((m) => m.userId === userId);
      if (member) member.displayname = desiredName;
    }
  } catch (err) {
    logger.warn('UI', 'Could not update Matrix display name:', err.message);
  }
}
