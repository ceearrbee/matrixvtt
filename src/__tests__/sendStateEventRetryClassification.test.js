/**
 * sendStateEvent must classify failures correctly:
 *   - 429  → retriable, parked in the queue (caller does not see throw)
 *   - 5xx  → retriable, parked in the queue
 *   - 4xx  (other) → permanent, thrown so the caller can surface it
 *   - >64KB content → rejected before the network call
 *
 * Previously only the queue-drain side of the loop was covered; the
 * upstream classification was implicit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendStateEvent } from '../state/queue.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeSm(send) {
  return {
    _retryQueue: new Map(),
    _drainTimer: null,
    lastSentState: new Map(),
    settings: {},
    widgetManager: { sendStateEvent: send },
  };
}

class HttpError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

describe('sendStateEvent retry classification', () => {
  let send;
  beforeEach(() => { send = vi.fn(); });

  it('does not throw on 429 - queues for retry instead', async () => {
    send.mockRejectedValue(new HttpError(429));
    const sm = makeSm(send);
    await expect(sendStateEvent(sm, EVENT_TYPES.TOKEN, 't1', { id: 't1', map_id: 'm1', sheet_id: 's1', col: 0, row: 0 })).resolves.toBeUndefined();
    expect(sm._retryQueue.size).toBe(1);
  });

  it('does not throw on 503 - queues like 429', async () => {
    send.mockRejectedValue(new HttpError(503));
    const sm = makeSm(send);
    await expect(sendStateEvent(sm, EVENT_TYPES.TOKEN, 't1', { id: 't1', map_id: 'm1', sheet_id: 's1', col: 0, row: 0 })).resolves.toBeUndefined();
    expect(sm._retryQueue.size).toBe(1);
  });

  it('throws on 403 - permanent failures must surface', async () => {
    send.mockRejectedValue(new HttpError(403));
    const sm = makeSm(send);
    await expect(sendStateEvent(sm, EVENT_TYPES.TOKEN, 't1', { id: 't1', map_id: 'm1', sheet_id: 's1', col: 0, row: 0 })).rejects.toThrow();
    expect(sm._retryQueue.size).toBe(0);
  });

  it('throws on 404 - permanent failures must surface', async () => {
    send.mockRejectedValue(new HttpError(404));
    const sm = makeSm(send);
    await expect(sendStateEvent(sm, EVENT_TYPES.TOKEN, 't1', { id: 't1', map_id: 'm1', sheet_id: 's1', col: 0, row: 0 })).rejects.toThrow();
    expect(sm._retryQueue.size).toBe(0);
  });

  it('rejects oversized content (>64KB) before the network call', async () => {
    send.mockResolvedValue({});
    const sm = makeSm(send);
    const huge = 'x'.repeat(64 * 1024); // 64KB string, >MAX_EVENT_BYTES once JSON-encoded
    await expect(sendStateEvent(sm, EVENT_TYPES.HANDOUT, 'h1', { body: huge }))
      .rejects.toThrow(/too large/);
    expect(send).not.toHaveBeenCalled();
  });

  it('dedups identical content - second call does not hit the network', async () => {
    send.mockResolvedValue({});
    const sm = makeSm(send);
    const content = { id: 'c1', name: 'Aria', type: 'pc' };
    await sendStateEvent(sm, EVENT_TYPES.CHARACTER, 'c1', content);
    await sendStateEvent(sm, EVENT_TYPES.CHARACTER, 'c1', { ...content });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
