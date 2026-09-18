/**
 * first-time-setup.js - entry points for the setup flow. The wizard
 * modal body lives in `./setup-wizard.js`; tombstone + save
 * orchestration in `./setup-tombstone.js` + `./setup-persistence.js`.
 * This file only owns the auth gate in front of the wizard.
 */

import { renderSetupWizard } from './setup-wizard.js';
import { showWaitingForGM } from './WelcomeModals.jsx';
import {
  tombstoneOldEntities,
  tombstoneStaleEvents,
} from './setup-tombstone.js';
import { saveInitialState } from './setup-persistence.js';

export { tombstoneOldEntities, tombstoneStaleEvents, saveInitialState };

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
