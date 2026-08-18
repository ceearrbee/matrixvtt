/**
 * Periodic IndexedDB snapshots of the campaign state. The user
 * can fall back to the most recent snapshot if a Matrix outage,
 * corrupted state event, or accidental wipe drops the live data.
 *
 * Snapshot scope: per-(userId, roomId), one rolling slot. Older
 * snapshots are overwritten - the goal is recovery, not version
 * control. Future work can extend to a ring buffer if requested.
 *
 * Snapshot lives in IndexedDB and never round-trips through Matrix:
 * it's a local safety net, not a backup. Privacy is the same as the
 * user's browser-data privacy.
 */

import { get, set } from 'idb-keyval';
import { exportCampaign, importCampaign } from '../state/campaign-sync.js';

const KEY_PREFIX = 'mxvtt:snapshot';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const snapshotCache = new Map();
const deletedSnapshotKeys = new Set();

function _key(userId, roomId) { return `${KEY_PREFIX}:${userId}:${roomId}`; }

function _hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function _persistSnapshot(key, payload) {
  if (_hasIndexedDb()) return set(key, payload);
  localStorage.setItem(key, JSON.stringify(payload));
  return Promise.resolve();
}

async function _readSnapshot(key) {
  if (_hasIndexedDb()) return get(key);
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Capture a snapshot of the StateManager's current state. Idempotent
 * to call repeatedly - the previous snapshot is overwritten.
 *
 * @returns {{ saved: boolean, ts: number, sizeBytes: number } | null}
 */
export function saveSnapshot(state, userId, roomId) {
  if (!userId || !roomId || !state) return null;
  try {
    const exported = exportCampaign(state);
    const payload = {
      saved_at: Date.now(),
      campaign: exported,
    };
    const json = JSON.stringify(payload);
    const key = _key(userId, roomId);
    deletedSnapshotKeys.delete(key);
    snapshotCache.set(key, payload);
    _persistSnapshot(key, payload).catch(() => {});
    return { saved: true, ts: payload.saved_at, sizeBytes: json.length };
  } catch {
    // Quota exceeded / private mode / serialisation failure - fail
    // silently. The user keeps the live state; snapshot is best-effort.
    return null;
  }
}

/**
 * Read the most recent snapshot, or null if none exists.
 * @returns {Promise<{ saved_at: number, campaign: ReturnType<typeof exportCampaign> } | null>}
 */
export async function loadSnapshot(userId, roomId) {
  if (!userId || !roomId) return null;
  const key = _key(userId, roomId);
  if (deletedSnapshotKeys.has(key)) return null;
  if (snapshotCache.has(key)) return snapshotCache.get(key);
  try {
    const payload = await _readSnapshot(key);
    if (!payload?.campaign) return null;
    return payload;
  } catch { return null; }
}

/**
 * Restore the StateManager from a snapshot. Local-only - does NOT
 * push the restored state to Matrix; the user is responsible for
 * deciding whether to also `syncCampaignToMatrix(state)` afterward.
 */
export function restoreSnapshot(state, snapshot) {
  if (!snapshot?.campaign) return false;
  importCampaign(state, snapshot.campaign);
  return true;
}

/**
 * Start a periodic snapshot timer. Returns a stop function that
 * clears the interval. Uses a 5-minute cadence to match the
 * production audit's recommendation; tunable via the second arg.
 */
export function startSnapshotInterval(state, userId, roomId, intervalMs = SNAPSHOT_INTERVAL_MS) {
  if (!userId || !roomId) return () => {};
  const id = setInterval(() => saveSnapshot(state, userId, roomId), intervalMs);
  return () => clearInterval(id);
}

export function __clearSnapshotCacheForTests() {
  snapshotCache.clear();
  deletedSnapshotKeys.clear();
}
