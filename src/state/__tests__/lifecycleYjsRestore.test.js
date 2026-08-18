/**
 * lifecycle.init must restore persisted pending Yjs updates only after
 * the initial state (and its snapshot rebuild) has loaded, and must
 * flush both retry queues to storage on pagehide.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { init, destroy } from '../lifecycle.js';
import { STORAGE_KEYS, EVENT_TYPES } from '../../utils/constants.js';

function makeSm({ order }) {
  return {
    loadInitialState: vi.fn(async () => { order.push('load'); }),
    subscribeToStateEvents: vi.fn(),
    _retryQueue: new Map(),
    _debounceTimers: new Map(),
    subscriptionManager: { destroy: vi.fn() },
    widgetManager: {
      isStandalone: true,
      getYjsTransport: () => ({
        restorePersistedPending: vi.fn(() => { order.push('restore'); }),
      }),
    },
  };
}

afterEach(() => {
  sessionStorage.clear();
});

describe('lifecycle yjs restore + pagehide flush', () => {
  it('restores persisted pending updates after loadInitialState', async () => {
    const order = [];
    const sm = makeSm({ order });
    await init(sm);
    destroy(sm);
    expect(order).toEqual(['load', 'restore']);
  });

  it('flushes the retry queue to storage on pagehide, until destroyed', async () => {
    const order = [];
    const sm = makeSm({ order });
    await init(sm);

    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 't1', content: { hp: 1 } });
    window.dispatchEvent(new Event('pagehide'));
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE));
    expect(stored).toHaveLength(1);
    expect(stored[0].stateKey).toBe('t1');

    destroy(sm);
    sessionStorage.removeItem(STORAGE_KEYS.RETRY_QUEUE);
    window.dispatchEvent(new Event('pagehide'));
    expect(sessionStorage.getItem(STORAGE_KEYS.RETRY_QUEUE)).toBeNull();
  });
});
