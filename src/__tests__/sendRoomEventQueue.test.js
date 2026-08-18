/**
 * Room-event queue routing - sendRoomEvent must:
 *  - hand off to widgetManager.sendRoomEvent on the happy path
 *  - park 429/5xx into the retry queue (no throw)
 *  - throw on permanent errors (403/404/…)
 *  - re-attempt queued items via drainRetryQueue
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendRoomEvent, drainRetryQueue } from '../state/queue.js';

function makeSm(sendRoomEventFn) {
  return {
    _retryQueue: new Map(),
    _drainTimer: null,
    settings: { gm_user_ids: [] },
    widgetManager: {
      sendRoomEvent: sendRoomEventFn,
      sendStateEvent: vi.fn(),
      getRateLimitWait: () => 0,
      userId: '@me:s',
    },
  };
}

function httpError(status) {
  const e = new Error(`HTTP ${status}`);
  e.status = status;
  return e;
}

describe('sendRoomEvent - happy path', () => {
  it('delegates straight to widgetManager.sendRoomEvent and returns the result', async () => {
    const send = vi.fn().mockResolvedValue({ event_id: 'evt-1' });
    const sm = makeSm(send);
    const out = await sendRoomEvent(sm, 'm.room.message', { msgtype: 'm.text', body: 'hi' });
    expect(send).toHaveBeenCalledWith('m.room.message', { msgtype: 'm.text', body: 'hi' });
    expect(out).toEqual({ event_id: 'evt-1' });
    expect(sm._retryQueue.size).toBe(0);
  });
});

describe('sendRoomEvent - retriable failures', () => {
  it('429 → parks in retry queue, does not throw', async () => {
    const send = vi.fn().mockRejectedValue(httpError(429));
    const sm = makeSm(send);
    await expect(sendRoomEvent(sm, 'm.room.message', { body: 'hi' })).resolves.toBeUndefined();
    expect(sm._retryQueue.size).toBe(1);
  });

  it('5xx → parks in retry queue, does not throw', async () => {
    const send = vi.fn().mockRejectedValue(httpError(503));
    const sm = makeSm(send);
    await sendRoomEvent(sm, 'com.vtt.ping', { x: 1 });
    expect(sm._retryQueue.size).toBe(1);
  });

  it('queued entries preserve insertion order and replay through drain', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValue(undefined);
    const sm = makeSm(send);
    await sendRoomEvent(sm, 't', { n: 1 });
    await sendRoomEvent(sm, 't', { n: 2 });
    expect(sm._retryQueue.size).toBe(2);

    await drainRetryQueue(sm);
    expect(send).toHaveBeenCalledTimes(4); // 2 initial + 2 drain
    expect(sm._retryQueue.size).toBe(0);
    const drained = send.mock.calls.slice(2).map((c) => c[1].n);
    expect(drained).toEqual([1, 2]);
  });
});

describe('sendRoomEvent - permanent failures', () => {
  it('403 → throws, nothing queued', async () => {
    const send = vi.fn().mockRejectedValue(httpError(403));
    const sm = makeSm(send);
    await expect(sendRoomEvent(sm, 't', { x: 1 })).rejects.toThrow();
    expect(sm._retryQueue.size).toBe(0);
  });
});
