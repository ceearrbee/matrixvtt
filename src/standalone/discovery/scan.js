/**
 * scan.js - parallel chunked fetch of room name + VTT state for a
 * list of room ids, plus the label update and deleted-recent
 * prune helper. Network-only; no DOM bootstrap.
 */

import { removeRecentSession } from '../sessionStore.js';

const SCAN_ROOM_LIMIT = 200;
const SCAN_CHUNK_SIZE = 10;

export const SCAN_CONSTANTS = { SCAN_ROOM_LIMIT, SCAN_CHUNK_SIZE };

export async function scanRooms(app, client, roomIds) {
  const results = [];
  for (let i = 0; i < roomIds.length; i += SCAN_CHUNK_SIZE) {
    if (app.scanCancelled) break;
    const chunk = roomIds.slice(i, i + SCAN_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (id) => {
        try {
          const [name, vttState] = await Promise.all([
            client.getRoomName(id),
            client.getVttState(id),
          ]);
          return { id, name, vttState };
        } catch {
          return null;
        }
      }),
    );
    results.push(...chunkResults.filter(Boolean));
  }
  return results;
}

export function setScanningLabel(app, total, scanning) {
  const label = app.doc.querySelector('#active-loading span');
  if (total === 0) label.textContent = 'No joined rooms yet.';
  else if (total > SCAN_ROOM_LIMIT)
    label.textContent = `Scanning Matrix rooms… (${scanning} of ${total})`;
  else label.textContent = `Scanning ${scanning} Matrix room${scanning === 1 ? '' : 's'}…`;
}

/**
 * Drop stale recent-session entries - both rooms whose VTT state has
 * been tombstoned (state empty) and rooms the user is no longer joined
 * to (not in the scan result list). Returns the list of survivors;
 * caller re-renders the recent panel if the list shrank.
 *
 * `joinedIds` is the full set of joined room ids from getJoinedRooms.
 * Without it (older callers), we treat scan results as the authority
 * and only prune tombstoned-state rooms - this keeps backwards
 * compatibility for tests that didn't pass the third argument.
 */
export function pruneDeletedRecent(recentSessions, results, joinedIds) {
  const resultMap = new Map(results.map((r) => [r.id, r]));
  const joinedSet = joinedIds ? new Set(joinedIds) : null;
  const survivors = [];
  for (const s of recentSessions) {
    if (joinedSet && !joinedSet.has(s.roomId)) {
      removeRecentSession(s.userId, s.roomId);
      continue;
    }
    const result = resultMap.get(s.roomId);
    if (result) {
      const isDeleted = !result.vttState || Object.keys(result.vttState).length === 0;
      if (isDeleted) { removeRecentSession(s.userId, s.roomId); continue; }
    }
    survivors.push(s);
  }
  return survivors;
}
