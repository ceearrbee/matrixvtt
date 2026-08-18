/**
 * Locate (or lazily create) the user's personal library room.
 *
 * A library room is any joined room carrying a `com.vtt.library` marker
 * state event. Discovery scans joined rooms once and caches the hit in
 * user-scoped localStorage; the cache is always re-verified with a single
 * marker probe before it is trusted, so a stale entry (room left, or a
 * different account) falls back to a rescan.
 */

import { EVENT_TYPES, STORAGE_KEYS } from '../utils/constants.js';
import { readUserScoped, writeUserScoped } from '../utils/user-storage.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';

export function isLibraryMarker(content) {
  return !!content && typeof content === 'object' && !Array.isArray(content);
}

async function hasMarker(client, roomId) {
  const content = await client.getStateEventContent(roomId, EVENT_TYPES.LIBRARY_MARKER, '');
  return isLibraryMarker(content);
}

/**
 * Return the user's library room id, or null if none is found.
 * @param {any} client raw MatrixClient
 */
export async function findLibraryRoom(client) {
  const userId = client.userId;
  const cached = readUserScoped(STORAGE_KEYS.LIBRARY_ROOM, userId);
  if (cached && (await hasMarker(client, cached))) return cached;

  const joined = await client.getJoinedRooms();
  for (const roomId of joined) {
    if (await hasMarker(client, roomId)) {
      writeUserScoped(STORAGE_KEYS.LIBRARY_ROOM, userId, roomId);
      return roomId;
    }
  }
  return null;
}

/**
 * Return the user's library room, creating a marked one if none exists.
 * Room creation is routed through the rate-limit retry helper because it
 * is a rare but bursty operation shared across the app.
 * @param {any} client raw MatrixClient
 */
export async function ensureLibraryRoom(client) {
  const existing = await findLibraryRoom(client);
  if (existing) return existing;

  const roomId = await retryOnRateLimit(() =>
    client.createRoom('MatrixVTT Library', {
      initialState: [
        { type: EVENT_TYPES.LIBRARY_MARKER, state_key: '', content: { vtt_version: 1 } },
      ],
    })
  );
  writeUserScoped(STORAGE_KEYS.LIBRARY_ROOM, client.userId, roomId);
  return roomId;
}
