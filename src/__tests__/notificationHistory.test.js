/**
 * notification-history store - session-scoped log of every toast so the
 * user can scroll back through messages that auto-dismissed. Newest
 * first, capped, with an unread count derived from a last-seen stamp.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  notificationHistorySignal, lastSeenTsSignal,
  addNotification, markAllRead, clearNotifications, unreadCount, MAX_ENTRIES,
} from '../state/notification-history.js';

beforeEach(() => {
  notificationHistorySignal.value = [];
  lastSeenTsSignal.value = 0;
});

describe('notification-history', () => {
  it('addNotification prepends newest-first and stamps an id', () => {
    addNotification({ level: 'info', message: 'first', ts: 1 });
    addNotification({ level: 'error', message: 'second', ts: 2 });
    const list = notificationHistorySignal.value;
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
    expect(list[0].id).not.toBe(list[1].id);
  });

  it('caps history at MAX_ENTRIES', () => {
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      addNotification({ level: 'info', message: `m${i}`, ts: i });
    }
    expect(notificationHistorySignal.value.length).toBe(MAX_ENTRIES);
    expect(notificationHistorySignal.value[0].message).toBe(`m${MAX_ENTRIES + 9}`);
  });

  it('unreadCount counts only entries newer than lastSeenTs', () => {
    const history = [{ ts: 5 }, { ts: 3 }, { ts: 1 }];
    expect(unreadCount(history, 2)).toBe(2);
    expect(unreadCount(history, 5)).toBe(0);
    expect(unreadCount([], 0)).toBe(0);
  });

  it('markAllRead sets lastSeenTs so unread drops to zero', () => {
    addNotification({ level: 'info', message: 'x', ts: 10 });
    markAllRead(20);
    expect(unreadCount(notificationHistorySignal.value, lastSeenTsSignal.value)).toBe(0);
  });

  it('clearNotifications empties the history', () => {
    addNotification({ level: 'info', message: 'x', ts: 1 });
    clearNotifications();
    expect(notificationHistorySignal.value).toEqual([]);
  });

  it('toast() appends one entry with the normalized level', async () => {
    const { toast } = await import('../ui/notifications.js');
    notificationHistorySignal.value = [];
    toast({ _announce() {} }, 'network down', 'error');
    toast({ _announce() {} }, 'old style', 'warning');
    const list = notificationHistorySignal.value;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ level: 'warn', message: 'old style' });
    expect(list[1]).toMatchObject({ level: 'error', message: 'network down' });
  });
});
