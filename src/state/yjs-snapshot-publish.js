/**
 * Publish the current Yjs doc as a Matrix `com.matrixvtt.yjs.snapshot`
 * state event so future joiners read the seeded state synchronously
 * from `/state` instead of waiting for the asynchronous
 * `com.matrixvtt.yjs.update` timeline events to trickle in via `/sync`.
 *
 * Called after the setup wizard seeds a new campaign, after a campaign
 * import, and after a "wipe session" so reloads see the wipe immediately
 * rather than briefly loading the prior snapshot.
 *
 * GM-only - the snapshot is a regular Matrix state event and needs
 * canEditRoomState() to publish. Non-GM callers silently no-op.
 *
 * **Chunked.** matrix.org caps events at ~64 KB; a mid-size campaign's
 * binary snapshot exceeds that. We split the binary into ≤32 KB pieces
 * and publish one state event per chunk under
 * `state_key = "${marker}-${idx}"`. The loader in `yjsSnapshot.js`
 * reassembles by picking the highest marker for which all chunks are
 * present. See `snapshot-chunks.js` for the pure helpers.
 */

import * as Y from 'yjs';
import { YJS_EVENT_TYPES } from './YjsManager.js';
import { logger } from '../utils/logger.js';
import {
  splitBinaryToChunks, bytesToBase64, SNAPSHOT_CHUNK_BYTES,
  chooseLatestCompleteSnapshot,
} from './snapshot-chunks.js';
import { clearOldSnapshotGenerations } from './snapshot-tombstones.js';
import { probeRoomSnapshotState } from '../utils/room-snapshot-probe.js';

// Empty Yjs docs encode to a small frame (~3 bytes). Bail under this
// threshold so we never auto-republish a "real" snapshot for a doc
// with no meaningful state - that would clobber a future GM trying to
// seed the room.
const MIN_USEFUL_SNAPSHOT_BYTES = 64;

/**
 * @param {object} sm
 * @param {{force?: boolean}} [opts] force skips the unchanged-vector check
 * @returns {Promise<boolean>} true if every chunk was sent; false if any failed.
 */
export async function publishYjsSnapshot(sm, { force = false } = {}) {
  // canEditRoomState is async; an unawaited call is a truthy Promise
  // and lets PL-0 players attempt the publish (server 403s every one).
  if (!(await sm?.widgetManager?.canEditRoomState?.())) return false;

  // Boot and manual republish paths call in without any doc change; a
  // publish of an identical doc only bloats the room state.
  const vectorB64 = bytesToBase64(Y.encodeStateVector(sm.yjs.doc));
  if (!force && sm._lastSnapshotVector === vectorB64) {
    logger.log('YjsSnapshot', 'skipped - state vector unchanged since last publish');
    return true;
  }

  const snapshot = Y.encodeStateAsUpdate(sm.yjs.doc);
  const chunks = splitBinaryToChunks(snapshot, SNAPSHOT_CHUNK_BYTES);
  const marker = Date.now();
  const total = chunks.length;
  logger.log('YjsSnapshot',
    `publishing marker=${marker} binarySize=${snapshot.length} chunks=${total}`,
  );

  let failed = 0;
  for (let idx = 0; idx < chunks.length; idx++) {
    const stateKey = `${marker}-${idx}`;
    const content = {
      data: bytesToBase64(chunks[idx]),
      marker, idx, total,
    };
    try {
      await sm.sendStateEvent(YJS_EVENT_TYPES.SNAPSHOT, stateKey, content);
    } catch (err) {
      failed++;
      logger.warn('YjsSnapshot',
        `chunk ${idx + 1}/${total} (marker=${marker}) failed: ${err?.message || err}`,
      );
    }
  }

  if (failed > 0) {
    logger.warn('YjsSnapshot',
      `FAILED marker=${marker} reason=publish-incomplete (chunks landed: ${total - failed}/${total})`,
    );
    return false;
  }
  sm._lastSnapshotVector = vectorB64;
  logger.log('YjsSnapshot', `published marker=${marker} ok`);
  await _clearStaleGenerations(sm, marker);
  return true;
}

/**
 * Clear old snapshot generations, but only after a readback confirms
 * the just-published generation is complete server-side - a publish
 * whose chunks are still parked in the retry queue must never trigger
 * clears, or the room could briefly hold no readable snapshot.
 */
async function _clearStaleGenerations(sm, marker) {
  const api = sm.widgetManager?.getApi?.();
  if (!api?.receiveStateEvents) return;
  try {
    const events = await api.receiveStateEvents(YJS_EVENT_TYPES.SNAPSHOT);
    const latest = chooseLatestCompleteSnapshot(events ?? []);
    if (latest?.marker !== marker) {
      logger.log('YjsSnapshot',
        `skipping stale-generation clears - marker=${marker} not yet complete server-side`);
      return;
    }
    const cleared = await clearOldSnapshotGenerations(sm, events);
    if (cleared > 0) logger.log('YjsSnapshot', `cleared ${cleared} stale snapshot state keys`);
  } catch (err) {
    logger.warn('YjsSnapshot', `stale-generation clear failed: ${err?.message || err}`);
  }
}

/**
 * Self-heal recovery for rooms whose initial snapshot publish failed
 * partway (e.g. matrix.org rate-limited the second chunk during wizard
 * setup), leaving chunks 0..N-1 published but no usable snapshot while
 * the probe still saw "some chunk" and called the room populated.
 *
 * On boot, if (a) the local Yjs doc has non-trivial content (the GM's
 * own writes from a previous session, or live Yjs UPDATE events that
 * just streamed in), and (b) the published snapshot is incomplete or
 * absent, re-encode and re-publish; the queue retries any 429s.
 *
 * GM-only - the probe still gates on canEditRoomState inside
 * publishYjsSnapshot, but we also short-circuit early to avoid the
 * network round-trip on non-GM viewers.
 *
 * @param {object} sm
 * @returns {Promise<boolean>} true iff a republish happened and landed.
 */
export async function republishSnapshotIfMissing(sm) {
  if (!(await sm?.widgetManager?.canEditRoomState?.())) return false;
  const api = sm.widgetManager.getApi?.();
  if (!api) return false;

  const probeState = await probeRoomSnapshotState(api);
  if (probeState === 'present') return false;
  // 'unknown' means the probe couldn't tell (network blip) - don't
  // assume broken; leave the existing chunks alone.
  if (probeState === 'unknown') return false;

  const snapshot = Y.encodeStateAsUpdate(sm.yjs.doc);
  if (snapshot.length < MIN_USEFUL_SNAPSHOT_BYTES) {
    logger.log('YjsSnapshot',
      `auto-republish skipped - local doc empty (${snapshot.length} bytes)`,
    );
    return false;
  }
  logger.log('YjsSnapshot',
    `auto-republishing - probe='${probeState}', docBytes=${snapshot.length}`,
  );
  // The server provably lacks a snapshot, so the unchanged-vector skip
  // must not apply here.
  return publishYjsSnapshot(sm, { force: true });
}
