/**
 * stable-id.js - allocate reusable state_keys for VTT entities.
 *
 * Matrix's `/state` endpoint retains every `(type, state_key)` pair that
 * has ever been written, even after tombstoning - unique (e.g.
 * timestamp-based) IDs would add a permanent row to the room's state
 * response for every token / NPC / handout ever created.
 *
 * Allocating positional IDs (`tok-1`, `tok-2`, …) and picking the lowest
 * unused one scans the live collection. If a slot was tombstoned earlier,
 * the new write *overwrites* the emptied state event instead of creating
 * a fresh row - capping state-event growth at the working set size rather
 * than scaling with edit history.
 */

/**
 * Find the lowest unused positional ID for the given prefix by scanning
 * the local in-memory collection. Post-Yjs migration this collection is
 * authoritative - every routed type (token, character, npc, item, spell,
 * handout, table) mirrors its Y.Map into a ReactiveMap via the bridge,
 * so by the time a CRUD UI calls this, every concurrent GM's writes
 * have arrived via /sync.
 *
 * Async return preserved so callers can keep their existing `await`
 * patterns; the body is synchronous now that the legacy /state probe
 * (which did a server round-trip for routed types that don't appear in
 * /state post-migration) is gone.
 *
 * @param {string} prefix - e.g. 'tok', 'chr', 'npc', 'itm', 'spl', 'map', 'handout', 'table'
 * @param {Map<string, unknown>} existingMap
 * @param {number} maxScan - upper bound to prevent runaway scans
 * @returns {Promise<string>}
 */
export async function allocateEntityId(prefix, existingMap, maxScan = 10000) {
  return _scan(prefix, _keysOf(existingMap), maxScan);
}

function _keysOf(map) {
  return map?.keys ? map.keys() : [];
}

function _scan(prefix, liveKeys, maxScan) {
  const set = liveKeys instanceof Set ? liveKeys : new Set(liveKeys);
  for (let i = 1; i <= maxScan; i++) {
    const id = `${prefix}-${i}`;
    if (!set.has(id)) return id;
  }
  // Escape hatch: only reached if someone legitimately has maxScan live
  // entities of this type. Collision risk stays low because the caller
  // already has `maxScan` slots occupied - falling back to a timestamp
  // is only a problem if two GMs both overflow at the same millisecond.
  return `${prefix}-${Date.now()}`;
}
