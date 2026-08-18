import { describe, it, expect, vi, afterEach } from 'vitest';
import { WidgetManager } from '../WidgetManager.js';
import { attachWidgetYjs } from '../widget-yjs.js';

const rateLimitError = (retryAfterMs) => Object.assign(new Error('rate limited'), {
  errcode: 'M_LIMIT_EXCEEDED',
  ...(retryAfterMs != null ? { data: { retry_after_ms: retryAfterMs } } : {}),
});

const stubYjsManager = () => ({
  onUpdate: () => {},
  getStateVector: () => new Uint8Array(),
  handleMatrixUpdate: () => {},
  compareStateVector: () => {},
});

const stubWidgetManagerForYjs = (sendRoomEvent) => ({
  _yjsTransport: null,
  userId: '@a:hs',
  roomId: '!r:hs',
  sendRoomEvent,
  widgetApi: {
    observeRoomEvents: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('widget rate-limit parity', () => {
  it('notes retry_after_ms from a 429 sendRoomEvent and counts it down', async () => {
    vi.useFakeTimers();
    const wm = new WidgetManager();
    const err = rateLimitError(3000);
    wm.widgetApi = { sendRoomEvent: vi.fn().mockRejectedValue(err) };

    await expect(wm.sendRoomEvent('com.matrixvtt.yjs.update', {})).rejects.toBe(err);
    expect(wm.getRateLimitWait()).toBeGreaterThan(2500);
    expect(wm.getRateLimitWait()).toBeLessThanOrEqual(3000);

    vi.advanceTimersByTime(3000);
    expect(wm.getRateLimitWait()).toBe(0);
  });

  it('notes a default wait for a 429 without retry_after_ms, on sendStateEvent too', async () => {
    vi.useFakeTimers();
    const wm = new WidgetManager();
    const err = rateLimitError();
    wm.widgetApi = { sendStateEvent: vi.fn().mockRejectedValue(err) };

    await expect(wm.sendStateEvent('com.vtt.settings', '', {})).rejects.toBe(err);
    expect(wm.getRateLimitWait()).toBeGreaterThan(0);
  });

  it('does not set a wait for non-rate-limit errors', async () => {
    const wm = new WidgetManager();
    const err = new Error('boom');
    wm.widgetApi = { sendRoomEvent: vi.fn().mockRejectedValue(err) };

    await expect(wm.sendRoomEvent('m.room.message', {})).rejects.toBe(err);
    expect(wm.getRateLimitWait()).toBe(0);
  });

  it('widget-yjs shim retries a rate-limited send instead of failing the chunk', async () => {
    const sendRoomEvent = vi.fn()
      .mockRejectedValueOnce(rateLimitError(10))
      .mockResolvedValueOnce({ event_id: '$ok' });
    const wm = stubWidgetManagerForYjs(sendRoomEvent);
    const transport = attachWidgetYjs(wm, stubYjsManager());

    try {
      await transport.matrixClient.sendVTTEvent('!r:hs', 'com.matrixvtt.yjs.update', null, { seq: 's', idx: 0, total: 1, data: '' });
      expect(sendRoomEvent).toHaveBeenCalledTimes(2);
    } finally {
      transport.destroy();
    }
  });
});
