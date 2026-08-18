/**
 * Private notes - per-user, per-entity scratchpad backed by
 * localStorage. Truly private: notes never leave the device and
 * are never synced to Matrix. Compared to a `com.vtt.private_note`
 * state event, this trades cross-device sync for absolute privacy
 * and zero new server infrastructure.
 *
 * Storage shape:
 *   localStorage[`mxvtt:private-notes:${userId}:${roomId}`] = JSON({
 *     [entityId]: { body: string, updated_at: number }
 *   })
 */

const KEY_PREFIX = 'mxvtt:private-notes';

function _key(userId, roomId) {
  return `${KEY_PREFIX}:${userId}:${roomId}`;
}

function _readAll(userId, roomId) {
  if (!userId || !roomId) return {};
  try {
    const raw = localStorage.getItem(_key(userId, roomId));
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch { return {}; }
}

function _writeAll(userId, roomId, store) {
  if (!userId || !roomId) return;
  try { localStorage.setItem(_key(userId, roomId), JSON.stringify(store)); }
  catch { /* private mode / quota */ }
}

/** Return the current user's private note for `entityId`, or '' if none. */
export function getPrivateNote(userId, roomId, entityId) {
  if (!entityId) return '';
  const store = _readAll(userId, roomId);
  return store[entityId]?.body || '';
}

/** Persist `body` as the user's private note for `entityId`. */
export function setPrivateNote(userId, roomId, entityId, body) {
  if (!entityId) return;
  const store = _readAll(userId, roomId);
  const trimmed = String(body ?? '');
  if (!trimmed) {
    delete store[entityId];
  } else {
    store[entityId] = { body: trimmed, updated_at: Date.now() };
  }
  _writeAll(userId, roomId, store);
}

