/**
 * setup-persistence.js - initial-save orchestration + post-save
 * verification for the first-time-setup wizard.
 *
 * Extracted from `first-time-setup.js` so the sequencing logic is
 * testable in isolation and the wizard UI doesn't own Matrix-write
 * policy.
 */

import { logger } from '../utils/logger.js';
import { esc } from '../utils/component.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';
import { plSplitFailedSignal } from '../state/ui-signals.js';

/**
 * After the wizard's save + drain completes, re-read room state and
 * diff against the tombstones the wizard intended to land. The
 * entity-collection check (token/character/...) was removed in the
 * Yjs migration: those types now live in the Yjs CRDT and don't
 * appear as legacy state events on the server, so checking
 * `getRoomState()` for them produced false positives that killed
 * the wizard. Tombstones still flow through the legacy state-event
 * writer (tombstoneForeignEvent), so verifying those landed remains
 * useful for legacy-room migrations.
 *
 * @returns {Promise<{verified: boolean, discrepancies: Array<{type,id,issue}>}>}
 */
export async function verifyInitialSave(ui, intendedTombstones = []) {
  if (intendedTombstones.length === 0) return { verified: true, discrepancies: [] };

  const events = await ui.widgetManager?.getRoomState?.();
  if (!Array.isArray(events)) return { verified: false, discrepancies: [] };
  const byKey = new Map();
  for (const e of events) byKey.set(`${e.type}:${e.state_key ?? ''}`, e);

  const discrepancies = [];
  const hasContent = (ev) => ev?.content && Object.keys(ev.content).length > 0;

  for (const { type, id } of intendedTombstones) {
    const serverEv = byKey.get(`${type}:${id}`);
    if (hasContent(serverEv)) {
      discrepancies.push({ type, id, issue: 'tombstone did not land - still live' });
    }
  }

  return { verified: discrepancies.length === 0, discrepancies };
}

/**
 * Precompute the total number of state writes saveInitialState
 * performs, so the progress card can size its bar before the operation.
 */
export function countInitialSaveSteps(_ui) {
  // are already in Yjs from initBlankCampaign, so the wizard no
  // longer rewrites them per-entry.
  return 5;
}

/**
 * Apply the GM/player power-level split, retrying once through the
 * rate-limit helper. On permanent failure: toast the consequence and
 * flag plSplitFailedSignal so the GM panel offers a retry.
 * @returns {Promise<boolean>} true when the split landed.
 */
export async function ensurePlayerPowerLevels(ui, gmUserIds) {
  if (typeof ui.widgetManager?.setRoomPowerLevels !== 'function') return true;
  try {
    await retryOnRateLimit(() => ui.widgetManager.setRoomPowerLevels(gmUserIds), { maxAttempts: 2 });
    plSplitFailedSignal.value = null;
    return true;
  } catch (err) {
    logger.warn('UI', 'Power level split failed:', err?.message || err);
    plSplitFailedSignal.value = [...gmUserIds];
    ui._toast?.(
      'Could not set player permissions: players may not be able to edit tokens or characters. Retry from the GM panel.',
      'warning',
    );
    return false;
  }
}

/**
 * Save initial state to Matrix (called after first-time setup).
 * Each write goes through the StateManager facade; the one exception
 * is the drawings batch-clear, which has no per-stroke writer.
 */
export async function saveInitialState(ui, onProgress) {
  // Snapshot values synchronously - the sync loop may deliver old
  // events concurrently and overwrite state.map / state.activeMapId
  // between awaits, causing a null-map crash mid-save.
  const map        = ui.state.map;
  const fog        = ui.state.fog;
  const initiative = ui.state.initiative;
  const settings   = { ...ui.state.settings };

  if (!map) {
    logger.error('UI', 'saveInitialState: map is null at start - aborting save');
    ui._toast('Session could not be saved: map state is missing. Reload and try again.', 'error');
    return;
  }

  try {
    // Enforce GM/player power-level split before writing any other
    // state. Non-fatal for the save, but never silent: without it,
    // players join and cannot write tokens or characters.
    await ensurePlayerPowerLevels(ui, settings.gm_user_ids || []);

    let step = 0;
    const tick = (label) => { step += 1; onProgress?.(step, label); };

    await ui.state.updateSettings(settings);
    tick('settings');
    await new Promise((r) => setTimeout(r, 100));
    if (ui.state.activeMapId) {
      await ui.state.updateMap(ui.state.activeMapId, map);
    }
    tick('map');
    await new Promise((r) => setTimeout(r, 100));
    await ui.state.updateFog(fog);
    tick('fog');
    await new Promise((r) => setTimeout(r, 100));
    await ui.state.updateInitiative(initiative);
    tick('initiative');
    await new Promise((r) => setTimeout(r, 100));

    // Clear any per-stroke drawings left over from a previous session.
    // `clearDrawings` tombstones each extant stroke-keyed event.
    await ui.state.clearDrawings();
    tick('drawings');
    await new Promise((r) => setTimeout(r, 100));

  } catch (error) {
    // Visible error is essential: otherwise the GM sees the VTT working
    // but no one else can discover or join (settings never stored).
    const msg = `Session could not be saved to Matrix: ${error.message}. ` +
      'Other clients will not be able to join. ' +
      'Make sure you have permission to send events in this room.';
    ui._toast(msg, 'error');
    ui._log('⚠️', esc(msg));
  }
}
