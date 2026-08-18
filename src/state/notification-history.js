/**
 * notification-history.js - session-scoped log of toast notifications.
 *
 * Every toast (info | success | warn | error) is appended here from the
 * single `toast()` funnel in src/ui/notifications.js, so the user can
 * scroll back through messages that auto-dismissed. In-memory only;
 * clears on reload, matching the toasts' own lifetime. Pure helpers keep
 * the store unit-testable without a DOM.
 */

import { signal } from '@preact/signals';

export const MAX_ENTRIES = 100;
let _seq = 0;

/** @typedef {{ id: number, level: string, message: string, ts: number }} NotificationEntry */

/** Newest-first list of notifications. */
export const notificationHistorySignal = signal(/** @type {NotificationEntry[]} */ ([]));

/** Timestamp the log was last opened; entries newer than this are "unread". */
export const lastSeenTsSignal = signal(0);

/** Prepend an entry, enforcing the cap. Returns the stored entry. */
export function addNotification({ level, message, ts = Date.now() }) {
  const entry = { id: ++_seq, level, message, ts };
  const next = [entry, ...notificationHistorySignal.value];
  if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
  notificationHistorySignal.value = next;
  return entry;
}

export function markAllRead(now = Date.now()) {
  lastSeenTsSignal.value = now;
}

export function clearNotifications() {
  notificationHistorySignal.value = [];
}

/** Pure: count entries strictly newer than `lastSeenTs`. */
export function unreadCount(history, lastSeenTs) {
  let n = 0;
  for (const e of history) if (e.ts > lastSeenTs) n += 1;
  return n;
}
