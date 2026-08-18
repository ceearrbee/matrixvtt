/**
 * session-ops.js - delete-session orchestration. The settings
 * modal itself lives in `../Settings.jsx`.
 */

import { VTT_EVENTS, EVENT_TYPES } from '../../utils/constants.js';
import { FOG_MODES } from '../../utils/ui-constants.js';
import { tombstoneStaleEvents } from '../first-time-setup.js';
import { openProgress, waitForQueueDrain } from '../progress-modal.js';
import { clearRoomVisited } from '../../utils/room-visited.js';


export async function deleteSession(ui) {
  if (!ui.state.isGM()) {
    ui._toast('Only GMs can delete a session');
    return;
  }

  // Enumerate all current com.vtt.* state events straight from the room so we
  // catch types we don't load into memory (or events from older schema
  // versions). Relying on ui.state.* Maps left ghost events behind and the
  // discovery screen then classified the room as "live".
  const room = await _fetchVttStateEvents(ui).catch(() => null);
  const targets = room ?? _fallbackFromLocalState(ui);

  // Settings last - clearing gm_user_ids before the other writes would revoke
  // our own permission mid-delete.
  targets.sort((a, b) => (a.type === EVENT_TYPES.SETTINGS ? 1 : 0) - (b.type === EVENT_TYPES.SETTINGS ? 1 : 0));

  const progress = openProgress({ title: 'Deleting session', total: targets.length });
  let failures;
  try {
    failures = await tombstoneStaleEvents(ui, targets, (done, detail) => progress.update(done, detail));
  } catch (err) {
    progress.fail(err?.message || 'Delete failed');
    throw err;
  }

  // Wait for any 429-parked retries to flush before tearing down the client.
  // destroy() clears the drain timer, so closing now would drop pending
  // writes and leave ghost state in the room. waitForQueueDrain loops
  // until the queue actually empties; no max-wait, because non-429 errors
  // are dropped from the queue by drainRetryQueue so it always eventually
  // empties on a healthy connection.
  if ((ui.state._retryQueue?.size ?? 0) > 0) {
    progress.setTitle('Finalizing writes');
  }
  await waitForQueueDrain(
    ui.state,
    (done, detail) => progress.update(done, detail),
    (n) => progress.setTotal(n),
  );

  if (failures.length) {
    const first = failures[0];
    const summary = `${failures.length}/${targets.length} writes failed (e.g. ${first.type}#${first.id}: ${first.err?.message ?? 'error'}). Some ghost state may remain - see console for details.`;
    progress.fail(summary);
    ui._toast(`Delete: ${summary}`);
  } else {
    progress.close();
    ui._toast('Session deleted', 'success');
  }

  if (ui.widgetManager.isAppClient) {
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.DELETE_SESSION));
    return;
  }

  ui.state._clearAllState?.({ clearYjs: true });
  ui.state.settings = { gm_user_ids: [], name: '', system: 'generic', grid_px: 40 };
  ui.state.initiative = { active: false, round: 0, current_index: 0, order: [] };
  ui.state.fog = { mode: FOG_MODES.HIDDEN, revealed: [] };
  // Snapshot the now-empty Y.Doc so reloads see the wipe immediately
  // via /state instead of briefly loading the prior snapshot.
  const { publishYjsSnapshot } = await import('../../state/yjs-snapshot-publish.js');
  await publishYjsSnapshot(ui.state);
  clearRoomVisited(ui.widgetManager?.userId, ui.widgetManager?.roomId);
  ui._welcomeShown = false;
  requestAnimationFrame(() => ui.showFirstTimeSetup({ bypassAuthCheck: true }));
}

async function _fetchVttStateEvents(ui) {
  const wm = ui.widgetManager;
  if (!wm || typeof wm.getRoomState !== 'function') return null;
  const events = await wm.getRoomState();
  if (!Array.isArray(events)) return null;
  const myUserId = wm.userId;
  return events
    .filter(e => typeof e.type === 'string'
      && e.type.startsWith('com.vtt.')
      && e.content && Object.keys(e.content).length > 0
      // Matrix 403s when you try to write another user's per-user state
      // (legacy com.vtt.cursor state_keys are Matrix user IDs). Drop
      // foreign-owned events so the tombstone pass stays inside writes
      // we actually have permission for.
      && !_isForeignUserStateKey(e.state_key, myUserId))
    .map(e => ({ type: e.type, id: e.state_key ?? '' }));
}

function _isForeignUserStateKey(stateKey, myUserId) {
  if (typeof stateKey !== 'string') return false;
  if (!stateKey.startsWith('@') || !stateKey.includes(':')) return false;
  return stateKey !== myUserId;
}

function _fallbackFromLocalState(ui) {
  const out = [];
  const push = (type, map) => { if (map?.forEach) map.forEach((_, id) => out.push({ type, id })); };
  push(EVENT_TYPES.TOKEN, ui.state.tokens);
  push(EVENT_TYPES.CHARACTER, ui.state.characters);
  push(EVENT_TYPES.NPC, ui.state.npcs);
  push(EVENT_TYPES.ITEM, ui.state.items);
  push(EVENT_TYPES.SPELL, ui.state.spells);
  push(EVENT_TYPES.HANDOUT, ui.state.handouts);
  push(EVENT_TYPES.TABLE, ui.state.tables);
  push(EVENT_TYPES.MAP, ui.state.maps);
  out.push({ type: EVENT_TYPES.FOG, id: '' });
  out.push({ type: EVENT_TYPES.INITIATIVE, id: '' });
  out.push({ type: EVENT_TYPES.SETTINGS, id: '' });
  return out;
}
