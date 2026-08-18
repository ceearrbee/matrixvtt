/**
 * Snapshot generations accumulate: every publish writes fresh
 * `${marker}-${idx}` state keys and nothing cleared the old ones, so a
 * long session bloats the room state (slow joins, heavy state
 * resolution). After a publish is verified complete server-side, the
 * stale generations get their state keys cleared (empty content). The
 * two newest complete generations always survive, and the newest
 * generation is never touched even when incomplete, so a mid-clear
 * crash can never strand the room without a readable snapshot.
 */

import { YJS_EVENT_TYPES } from './YjsManager.js';

const KEEP_NEWEST_COMPLETE = 2;
const MAX_CLEARS_PER_CYCLE = 20;

/**
 * Pick the snapshot state keys that are safe to clear.
 * @param {Array<{state_key?: string, content?: any}>} events
 * @param {{keepNewestComplete?: number, maxClears?: number}} [opts]
 * @returns {string[]}
 */
export function selectKeysToClear(events, {
  keepNewestComplete = KEEP_NEWEST_COMPLETE,
  maxClears = MAX_CLEARS_PER_CYCLE,
} = {}) {
  /** @type {Map<number, {keys: string[], total: number, seen: Set<number>}>} */
  const groups = new Map();
  /** @type {string[]} */
  const markerless = [];

  for (const e of events ?? []) {
    const c = e?.content;
    const key = e?.state_key;
    if (!c || typeof c.data !== 'string' || typeof key !== 'string') continue;
    if (typeof c.marker !== 'number') {
      markerless.push(key);
      continue;
    }
    const idx = Number.isInteger(c.idx) ? c.idx : 0;
    const total = Number.isInteger(c.total) && c.total > 0 ? c.total : 1;
    let group = groups.get(c.marker);
    if (!group) {
      group = { keys: [], total, seen: new Set() };
      groups.set(c.marker, group);
    }
    group.keys.push(key);
    group.seen.add(idx);
  }

  const markers = [...groups.keys()].sort((a, b) => b - a);
  const completeMarkers = markers.filter((m) => {
    const g = groups.get(m);
    for (let i = 0; i < g.total; i++) if (!g.seen.has(i)) return false;
    return true;
  });

  const keep = new Set(completeMarkers.slice(0, keepNewestComplete));
  // A publish may be mid-flight: never touch the newest generation.
  if (markers.length > 0) keep.add(markers[0]);

  const toClear = [];
  for (const m of markers) {
    if (keep.has(m)) continue;
    toClear.push(...groups.get(m).keys);
  }
  // Markerless events are unreadable by the loader anyway, but only
  // clear them once a complete generation provably exists.
  if (completeMarkers.length > 0) toClear.push(...markerless);

  return [...new Set(toClear)].slice(0, maxClears);
}

/**
 * Clear stale snapshot generations. Writes ride sm.sendStateEvent, so
 * 429s park in the retry queue instead of failing.
 * @param {any} sm
 * @param {Array<object>|null} [events] pre-fetched snapshot state events
 * @returns {Promise<number>} number of keys cleared
 */
export async function clearOldSnapshotGenerations(sm, events = null) {
  if (!events) {
    const api = sm.widgetManager?.getApi?.();
    if (!api?.receiveStateEvents) return 0;
    events = await api.receiveStateEvents(YJS_EVENT_TYPES.SNAPSHOT);
  }
  const keys = selectKeysToClear(events ?? []);
  for (const key of keys) {
    await sm.sendStateEvent(YJS_EVENT_TYPES.SNAPSHOT, key, {});
  }
  return keys.length;
}
