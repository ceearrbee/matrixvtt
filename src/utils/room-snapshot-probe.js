/**
 * Shared "does this room have a published Yjs snapshot?" probe.
 *
 * Two call sites need this predicate:
 *   1. app-client.js#initVTT - to suppress an unreliable `forceWizard`
 *      flag when /joined_rooms gives a stale answer.
 *   2. ui/render-policy.js#renderUI - to suppress the wizard on reload
 *      when local state hydration (Yjs → ReactiveMap bridges) hasn't
 *      finished by the time the wizard decision runs.
 *
 * Keeping both probes on a shared predicate guarantees the two truth
 * tests can't drift - the symptom of drift is "wizard fires on every
 * reload after a seeded demo," which is exactly the bug this fixes.
 */

import { YJS_EVENT_TYPES } from '../state/YjsManager.js';
import { chooseLatestCompleteSnapshot } from '../state/snapshot-chunks.js';

/**
 * @param {{ content?: { data?: unknown, marker?: unknown }, type?: string }} e
 */
function isUsableSnapshotEvent(e) {
  return !!(e && e.content && e.content.data && typeof e.content.marker === 'number');
}

/**
 * Tri-state version of the probe. Distinguishes "empty array" (room
 * confirmed empty) from "probe error" (cannot tell). Used by the
 * render-policy stamp-self-heal path: we only want to invalidate a
 * room-visited stamp when we've *positively confirmed* the room has
 * no snapshot - never on a probe error, because a network blip would
 * then surface the wizard for a populated room.
 *
 * @param {{ receiveStateEvents?: (type: string) => Promise<unknown[]> }} api
 * @returns {Promise<'present' | 'absent' | 'unknown'>}
 */
export async function probeRoomSnapshotState(api) {
  if (!api?.receiveStateEvents) return 'unknown';
  let events;
  try {
    events = await api.receiveStateEvents(YJS_EVENT_TYPES.SNAPSHOT);
  } catch {
    return 'unknown';
  }
  if (!Array.isArray(events)) return 'unknown';
  // Match the loader's definition of "usable": at least one marker
  // must have ALL its chunks present. A half-published multi-chunk
  // snapshot (e.g. chunk 0 of 2 landed, chunk 1 of 2 hit a 429) used
  // to register as 'present' here while the loader silently discarded
  // it for being incomplete - and the render-policy then suppressed
  // the wizard on a room with no usable state. The two must agree.
  const usable = chooseLatestCompleteSnapshot(events);
  return usable ? 'present' : 'absent';
}

/**
 * Probe via the standalone ClientManager's `getRoomState` accessor
 * (returns the full state-event array, not filtered by type). Used by
 * app-client.js where the snapshot fetch is bundled with other checks.
 *
 * @param {{ getRoomState?: () => Promise<Array<{type?: string, content?: any}>> }} clientManager
 * @returns {Promise<boolean>}
 */
export async function clientManagerHasSnapshot(clientManager) {
  try {
    const events = await clientManager?.getRoomState?.();
    if (!Array.isArray(events)) return false;
    return events.some((e) =>
      /** @type {any} */ (e)?.type === YJS_EVENT_TYPES.SNAPSHOT && isUsableSnapshotEvent(e),
    );
  } catch { return false; }
}
