/**
 * Retry queue persistence - flushQueueToStorage / restoreQueueFromStorage
 *
 * If the tab closes while events are queued, those writes are lost.
 * On pagehide, flush the pending queue to durable storage keyed by room
 * and user. On startup, restore and drain any saved queue.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushQueueToStorage, restoreQueueFromStorage } from '../state/syncer.js';
import { STORAGE_KEYS, EVENT_TYPES } from '../utils/constants.js';
import { pendingKey } from '../state/pending-storage.js';

const CTX = { userId: '@a:hs', roomId: '!r:hs' };
const KEY = pendingKey(STORAGE_KEYS.RETRY_QUEUE, CTX);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function makeSm(queue = new Map()) {
  return {
    _retryQueue: queue,
    widgetManager: { ...CTX, sendStateEvent: vi.fn().mockResolvedValue(undefined) },
    lastSentState: new Map(),
    _rateLimitedUntil: 0,
    _drainTimer: null,
  };
}

describe('queue persistence', () => {
  it('flushQueueToStorage saves queue entries to durable storage', () => {
    const q = new Map([
      [EVENT_TYPES.TOKEN + ':tok-1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { name: 'Goblin' } }],
    ]);
    const sm = makeSm(q);
    flushQueueToStorage(sm);
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe(EVENT_TYPES.TOKEN);
  });

  it('flushQueueToStorage writes empty array when queue is empty', () => {
    const sm = makeSm(new Map());
    flushQueueToStorage(sm);
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    expect(stored).toEqual([]);
  });

  it('restoreQueueFromStorage loads entries back into _retryQueue', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { cacheKey: 'k1', type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { name: 'Orc' } },
    ]));
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(sm._retryQueue.size).toBe(1);
    expect(sm._retryQueue.get('k1')?.type).toBe(EVENT_TYPES.TOKEN);
  });

  it('restoreQueueFromStorage clears the stored copy after restore', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { cacheKey: 'k1', type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} },
    ]));
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('restoreQueueFromStorage does nothing when storage is empty', () => {
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(sm._retryQueue.size).toBe(0);
  });
});
