/**
 * first-time-setup.js - entry points for the setup flow. The wizard
 * modal body lives in `./setup-wizard.js`; tombstone + save
 * orchestration in `./setup-tombstone.js` + `./setup-persistence.js`.
 * This file only owns the auth gate and the player welcome overlay.
 */

import { renderSetupWizard } from './setup-wizard.js';
import {
  showWaitingForGM,
  showPlayerWelcome as showPlayerWelcomeFn,
} from './WelcomeModals.jsx';
import {
  tombstoneOldEntities,
  tombstoneStaleEvents,
} from './setup-tombstone.js';
import {
  saveInitialState,
  verifyInitialSave,
  countInitialSaveSteps,
} from './setup-persistence.js';

export { tombstoneOldEntities, tombstoneStaleEvents, saveInitialState, verifyInitialSave, countInitialSaveSteps };

/** Show first-time setup wizard */
export async function showFirstTimeSetup(ui, { bypassAuthCheck = false } = {}) {
  // Check if this user can create a session (must be room mod/admin)
  const authOk = ui.widgetManager.userIdResolved;
  let canCreate = bypassAuthCheck;
  if (!canCreate) {
    try { canCreate = await ui.widgetManager.canEditRoomState(); } catch { /* default false */ }
  }

  if (!canCreate) {
    let level = 0;
    try { level = await ui.widgetManager.getUserPowerLevel(); } catch { /* shown as 0 */ }
    showWaitingForGM(ui, authOk, {
      userId: ui.widgetManager.userId,
      roomId: ui.widgetManager.roomId,
      level,
    });
    return;
  }

  renderSetupWizard(ui);
}

/**
 * Show a brief welcome overlay for players who haven't claimed a character yet.
 * Does nothing for GMs or players who already have a claimed character.
 */
export function showPlayerWelcome(ui) {
  if (ui.state.isGM()) return;

  const userId = ui.state.widgetManager?.userId;
  const hasClaimed = userId &&
    Array.from(ui.state.characters.values()).some(c => c.claimed_by_user_id === userId);
  if (hasClaimed) return;

  showPlayerWelcomeFn(ui, { hasCharacters: ui.state.characters.size > 0 });
}

