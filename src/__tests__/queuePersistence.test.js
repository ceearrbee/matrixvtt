/**
 * Retry queue persistence - flushQueueToStorage / restoreQueueFromStorage
 *
 * If the browser crashes while events are queued, those writes are lost.
 * On beforeunload, flush the pending queue to sessionStorage.
 * On startup, restore and drain any saved queue.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushQueueToStorage, restoreQueueFromStorage } from '../state/syncer.js';
import { STORAGE_KEYS, EVENT_TYPES } from '../utils/constants.js';

beforeEach(() => {
  sessionStorage.clear();
});

function makeSm(queue = new Map()) {
  return {
    _retryQueue: queue,
    widgetManager: { sendStateEvent: vi.fn().mockResolvedValue(undefined) },
    lastSentState: new Map(),
    _rateLimitedUntil: 0,
    _drainTimer: null,
  };
}

describe('queue persistence', () => {
  it('flushQueueToStorage saves queue entries to sessionStorage', () => {
    const q = new Map([
      [EVENT_TYPES.TOKEN + ':tok-1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { name: 'Goblin' } }],
    ]);
    const sm = makeSm(q);
    flushQueueToStorage(sm);
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe(EVENT_TYPES.TOKEN);
  });

  it('flushQueueToStorage writes empty array when queue is empty', () => {
    const sm = makeSm(new Map());
    flushQueueToStorage(sm);
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE) ?? 'null');
    expect(stored).toEqual([]);
  });

  it('restoreQueueFromStorage loads entries back into _retryQueue', () => {
    sessionStorage.setItem(STORAGE_KEYS.RETRY_QUEUE, JSON.stringify([
      { cacheKey: 'k1', type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { name: 'Orc' } },
    ]));
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(sm._retryQueue.size).toBe(1);
    expect(sm._retryQueue.get('k1')?.type).toBe(EVENT_TYPES.TOKEN);
  });

  it('restoreQueueFromStorage clears sessionStorage after restore', () => {
    sessionStorage.setItem(STORAGE_KEYS.RETRY_QUEUE, JSON.stringify([
      { cacheKey: 'k1', type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} },
    ]));
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE)).toBeNull();
  });

  it('restoreQueueFromStorage does nothing when sessionStorage is empty', () => {
    const sm = makeSm();
    restoreQueueFromStorage(sm);
    expect(sm._retryQueue.size).toBe(0);
  });
});
