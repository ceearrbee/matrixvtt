/**
 * Work made offline has to outlive the tab that made it.
 *
 * Both holding pens for unsent work used sessionStorage, which a
 * closed tab discards. A player whose phone dropped the connection,
 * kept playing, and then had the browser evict the tab lost every
 * edit with no sign anything had gone.
 *
 * The keys carry the room and the user, because one browser can hold
 * two accounts and one account can sit in two campaigns, and neither
 * may drain the other's writes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pendingKey, pendingStorage, clearPendingForUser, PENDING_MAX_BYTES,
} from '../state/pending-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('pending storage', () => {
  it('survives a closed tab, so it is not sessionStorage', () => {
    expect(pendingStorage()).toBe(window.localStorage);
  });

  it('names a key by room and user together', () => {
    const key = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!r:hs' });
    expect(key).toContain('!r:hs');
    expect(key).toContain('@a:hs');
  });

  it('keeps two rooms apart for one user', () => {
    const a = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!one:hs' });
    const b = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!two:hs' });
    expect(a).not.toBe(b);
  });

  it('keeps two users apart in one room', () => {
    const a = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!r:hs' });
    const b = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@b:hs', roomId: '!r:hs' });
    expect(a).not.toBe(b);
  });

  it('caps what one store may hold', () => {
    expect(PENDING_MAX_BYTES).toBeGreaterThan(0);
  });
});

describe('signing out drops the pending work', () => {
  it('clears every room this user had unsent work in', () => {
    const store = pendingStorage();
    store.setItem(pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!one:hs' }), '[]');
    store.setItem(pendingKey(STORAGE_KEYS.YJS_PENDING, { userId: '@a:hs', roomId: '!two:hs' }), 'x');
    clearPendingForUser('@a:hs');
    expect(store.getItem(pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@a:hs', roomId: '!one:hs' }))).toBeNull();
    expect(store.getItem(pendingKey(STORAGE_KEYS.YJS_PENDING, { userId: '@a:hs', roomId: '!two:hs' }))).toBeNull();
  });

  it('leaves the other account on the browser alone', () => {
    const store = pendingStorage();
    const theirs = pendingKey(STORAGE_KEYS.RETRY_QUEUE, { userId: '@b:hs', roomId: '!one:hs' });
    store.setItem(theirs, '[]');
    clearPendingForUser('@a:hs');
    expect(store.getItem(theirs)).toBe('[]');
  });
});

describe('the retry queue outlives the page that queued it', () => {
  it('drains on a later page for the same user and room', async () => {
    const { flushQueueToStorage, restoreQueueFromStorage } = await import('../state/syncer.js');
    const { EVENT_TYPES } = await import('../utils/constants.js');
    const ctx = { widgetManager: { userId: '@a:hs', roomId: '!r:hs' } };

    const first = {
      ...ctx,
      _retryQueue: new Map([[`${EVENT_TYPES.TOKEN}:tok-1`, {
        type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { name: 'Goblin' },
      }]]),
    };
    flushQueueToStorage(first);

    const second = { ...ctx, _retryQueue: new Map() };
    restoreQueueFromStorage(second);
    expect(second._retryQueue.size).toBe(1);
    expect(second._retryQueue.get(`${EVENT_TYPES.TOKEN}:tok-1`)?.stateKey).toBe('tok-1');
  });

  it('does not hand one room the other room\u2019s unsent writes', async () => {
    const { flushQueueToStorage, restoreQueueFromStorage } = await import('../state/syncer.js');
    const { EVENT_TYPES } = await import('../utils/constants.js');

    flushQueueToStorage({
      widgetManager: { userId: '@a:hs', roomId: '!one:hs' },
      _retryQueue: new Map([['k', { type: EVENT_TYPES.TOKEN, stateKey: 't', content: {} }]]),
    });

    const other = { widgetManager: { userId: '@a:hs', roomId: '!two:hs' }, _retryQueue: new Map() };
    restoreQueueFromStorage(other);
    expect(other._retryQueue.size).toBe(0);
  });
});
