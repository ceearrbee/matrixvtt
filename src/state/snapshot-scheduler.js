/**
 * snapshot-scheduler.js - keep the durable Yjs snapshot fresh.
 *
 * Durable state lives in `com.matrixvtt.yjs.snapshot` state events; live edits
 * ride the room timeline as `com.matrixvtt.yjs.update` events. Those update
 * events roll off the small initial-sync window, and nothing backfills them -
 * so any edit made after the last snapshot is lost on reload unless a new
 * snapshot captures it. Publishing only at setup / boot / manual GM
 * ops leaves a wide loss window.
 *
 * This scheduler republishes (debounced after edits settle, plus a periodic
 * safety flush) so the loss window shrinks to seconds. `publishYjsSnapshot`
 * is GM-gated and idempotent, so this is a no-op on non-GM clients and never
 * double-publishes.
 */

import { logger } from '../utils/logger.js';

// 15s debounce: each publish is a full-doc encode split into one state
// event per chunk, so publishing every burst of edits is the main
// driver of room-state bloat. The periodic flush still bounds the
// reload-loss window at a minute.
export const DEBOUNCE_MS = 15000;
export const PERIODIC_MS = 60000;

// Lazy-load to match the other snapshot call sites - keeps the publish path
// (and its chunking deps) in its own chunk rather than the main bundle.
async function defaultPublish(sm) {
  const { publishYjsSnapshot } = await import('./yjs-snapshot-publish.js');
  return publishYjsSnapshot(sm);
}

/**
 * @param {any} sm StateManager (needs `sm.yjs.updates$`)
 * @returns {() => void} dispose
 */
export function startSnapshotScheduler(sm, {
  publish = defaultPublish,
  debounceMs = DEBOUNCE_MS,
  periodicMs = PERIODIC_MS,
  onState = null, // (active: boolean) => void - for a "saving…" indicator
} = {}) {
  const updates$ = sm?.yjs?.updates$;
  if (!updates$?.subscribe) return () => {};

  let dirty = false;
  let publishing = false;
  let debounceTimer = null;

  const flush = async () => {
    if (publishing || !dirty) return;
    publishing = true;
    dirty = false;
    onState?.(true);
    try {
      await publish(sm);
    } catch (err) {
      logger.warn('SnapshotScheduler', `republish failed: ${err?.message || err}`);
    } finally {
      publishing = false;
      onState?.(false);
    }
  };

  const sub = updates$.subscribe((evt) => {
    // Re-snapshot after any doc change EXCEPT applying a snapshot itself
    // (that's not a new edit). Covers remote edits too, so a GM captures
    // players' changes (only GMs can write the snapshot state event).
    if (evt?.origin === 'snapshot') return;
    dirty = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, debounceMs);
  });

  // Safety net: a steady drip of edits keeps resetting the debounce, so a
  // periodic flush guarantees a snapshot at least every `periodicMs`.
  const periodic = setInterval(() => { if (dirty) flush(); }, periodicMs);

  return () => {
    sub?.unsubscribe?.();
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(periodic);
  };
}
