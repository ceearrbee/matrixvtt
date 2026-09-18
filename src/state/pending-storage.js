/**
 * Where unsent work waits, and under what name.
 *
 * Both holding pens (the Matrix retry queue and the Yjs pending
 * buffer) used sessionStorage, so a closed tab threw away edits the
 * user had already made. They belong in localStorage, which survives
 * the tab, and under a key carrying both the room and the user: one
 * browser can hold two accounts, one account can sit in two
 * campaigns, and neither may drain the other's writes.
 */

import { STORAGE_KEYS } from '../utils/constants.js';

/**
 * Enough for a long offline stretch, small enough that a wedged store
 * cannot fill the origin's quota and break login.
 */
export const PENDING_MAX_BYTES = 512 * 1024;

const PENDING_BASES = [STORAGE_KEYS.RETRY_QUEUE, STORAGE_KEYS.YJS_PENDING];

export function pendingStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function pendingKey(base, { userId, roomId }) {
  return `${base}:${roomId ?? 'unknown-room'}::${userId ?? 'anonymous'}`;
}

/** True when the payload fits; callers drop rather than throw. */
export function withinPendingCap(serialized) {
  return typeof serialized === 'string' && serialized.length <= PENDING_MAX_BYTES;
}

export function clearPendingForUser(userId) {
  const store = pendingStorage();
  if (!store || !userId) return;
  const suffix = `::${userId}`;
  const doomed = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.endsWith(suffix)) continue;
    if (PENDING_BASES.some((base) => key.startsWith(`${base}:`))) doomed.push(key);
  }
  doomed.forEach((key) => store.removeItem(key));
}
