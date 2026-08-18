/**
 * Rate-limit queue draining across retries.
 *
 * drainRetryQueue(sm):
 *  - drains all entries when not rate-limited
 *  - pauses and reschedules when rate-limited mid-drain
 *  - dispatches vtt:queue-empty when done
 *  - dispatches vtt:queue-pending when paused
 *  - drops entries that fail with non-429 errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drainRetryQueue, isRateLimited } from '../state/syncer.js';
import { awaitQueueDrain } from '../state/queue.js';
import { VTT_EVENTS, EVENT_TYPES } from '../utils/constants.js';

function collectEvents(type) {
  const events = [];
  const handler = (e) => events.push(e.detail ?? null);
  window.addEventListener(type, handler);
  return { events, cleanup: () => window.removeEventListener(type, handler) };
}

function makeSm(sendStateEvent, rateLimitedUntil = 0) {
  return {
    _retryQueue: new Map(),
    _drainTimer: null,
    widgetManager: {
      sendStateEvent,
      getRateLimitWait: () => Math.max(0, rateLimitedUntil - Date.now()),
      _client: null
    },
  };
}

describe('drainRetryQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('dispatches vtt:queue-empty immediately when queue is already empty', async () => {
    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_EMPTY);
    const sm = makeSm(vi.fn().mockResolvedValue(undefined));
    await drainRetryQueue(sm);
    cleanup();
    expect(events).toHaveLength(1);
  });

  it('sends a single entry and dispatches vtt:queue-empty when not rate-limited', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sm = makeSm(send);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { hp: 10 } });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_EMPTY);
    await drainRetryQueue(sm);
    cleanup();

    expect(send).toHaveBeenCalledTimes(1);
    expect(sm._retryQueue.size).toBe(0);
    expect(events).toHaveLength(1);
  });

  it('sends multiple entries (with inter-item delay) and dispatches vtt:queue-empty', async () => {
    vi.useRealTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const sm = makeSm(send);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: { hp: 10 } });
    sm._retryQueue.set('type:key2', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-2', content: { hp: 5 } });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_EMPTY);
    await drainRetryQueue(sm);
    cleanup();

    expect(send).toHaveBeenCalledTimes(2);
    expect(sm._retryQueue.size).toBe(0);
    expect(events).toHaveLength(1);
  }, 2000);

  it('pauses and dispatches vtt:queue-pending when rate-limited during drain', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    // Rate-limited for 5 seconds from now
    const sm = makeSm(send, Date.now() + 5000);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_PENDING);
    await drainRetryQueue(sm);
    cleanup();

    // Should NOT have sent anything (blocked by rate limit)
    expect(send).not.toHaveBeenCalled();
    // Queue should still have the entry
    expect(sm._retryQueue.size).toBe(1);
    // Should have dispatched queue-pending
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('drops an entry and continues when a non-429 error occurs', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Server error'));
    const sm = makeSm(send);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_EMPTY);
    await drainRetryQueue(sm);
    cleanup();

    // Entry should be dropped
    expect(sm._retryQueue.size).toBe(0);
    expect(events).toHaveLength(1);
  });

  it('pauses and reschedules on 429 error', async () => {
    const err = new Error('Rate limited');
    err.status = 429;
    const send = vi.fn().mockRejectedValue(err);
    const sm = makeSm(send);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_PENDING);
    await drainRetryQueue(sm);
    cleanup();

    // Entry should remain in queue (not dropped)
    expect(sm._retryQueue.size).toBe(1);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('queue event payloads', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('queue-pending carries the queue depth and the matrix source', async () => {
    const sm = makeSm(vi.fn().mockResolvedValue(undefined), Date.now() + 5000);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });
    sm._retryQueue.set('type:key2', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-2', content: {} });

    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_PENDING);
    await drainRetryQueue(sm);
    cleanup();

    expect(events[0]).toEqual({ count: 2, source: 'matrix' });
  });

  it('a rate-limit wait dispatches vtt:rate-limited with the remaining wait', async () => {
    const sm = makeSm(vi.fn().mockResolvedValue(undefined), Date.now() + 5000);
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });

    const { events, cleanup } = collectEvents(VTT_EVENTS.RATE_LIMITED);
    await drainRetryQueue(sm);
    cleanup();

    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('matrix');
    expect(events[0].retryAfterMs).toBeGreaterThan(4000);
    expect(events[0].retryAfterMs).toBeLessThanOrEqual(5000);
  });

  it('queue-empty carries the matrix source', async () => {
    const sm = makeSm(vi.fn().mockResolvedValue(undefined));
    const { events, cleanup } = collectEvents(VTT_EVENTS.QUEUE_EMPTY);
    await drainRetryQueue(sm);
    cleanup();
    expect(events[0]).toEqual({ source: 'matrix' });
  });

  it('awaitQueueDrain ignores queue-empty events from other sources', async () => {
    const err = new Error('Rate limited');
    err.status = 429;
    const sm = makeSm(vi.fn().mockRejectedValue(err));
    sm._retryQueue.set('type:key1', { type: EVENT_TYPES.TOKEN, stateKey: 'tok-1', content: {} });

    const result = awaitQueueDrain(sm, 1500);
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.QUEUE_EMPTY, { detail: { source: 'yjs' } }));
    await vi.advanceTimersByTimeAsync(1600);

    expect(await result).toBe('timeout');
  });
});
