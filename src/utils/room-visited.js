/**
 * room-visited.js - per-(user, room) stamp in localStorage that
 * records when the user successfully entered the VTT for a given
 * campaign. Used by `render-policy.js` to suppress the welcome
 * wizard on every reload after the first successful enter.
 *
 * Reasoning: the upstream snapshot probe (`probeRoomSnapshotState`) is
 * best-effort and depends on the matrix-js-sdk having the snapshot
 * state event surfaced at the moment renderUI runs. On a flaky
 * network / partial sync that probe returns false and the wizard
 * fires again - wrong default for a user who's been in this
 * campaign for days. This stamp is the persistent "I've been here
 * before" memory so reload-on-flaky-net never re-prompts.
 *
 * Cleared by Settings → Reset session, the explicit wipe path.
 */

const PREFIX = 'vtt:room-visited:';

function key(userId, roomId) {
  if (!userId || !roomId) return null;
  return `${PREFIX}${userId}:${roomId}`;
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 * @returns {boolean}
 */
export function roomAlreadyVisited(userId, roomId) {
  const k = key(userId, roomId);
  if (!k) return false;
  try { return !!window.localStorage.getItem(k); }
  catch { return false; }
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 */
export function stampRoomVisited(userId, roomId) {
  const k = key(userId, roomId);
  if (!k) return;
  try { window.localStorage.setItem(k, String(Date.now())); }
  catch { /* private mode, quota */ }
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 */
export function clearRoomVisited(userId, roomId) {
  const k = key(userId, roomId);
  if (!k) return;
  try { window.localStorage.removeItem(k); }
  catch { /* private mode */ }
}
