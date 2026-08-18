/**
 * widgetReadAdapter - widget-mode parity for getMessages.
 *
 * The widget API has no real backwards-pagination intent, so this
 * adapter exposes a one-shot history seed via receiveRoomEvents.
 * Locks in:
 *   - first call returns the events from receiveRoomEvents shaped like
 *     the matrix-js-sdk adapter's chunk format
 *   - hasMoreHistory flips to false after the first call so the
 *     "Load older messages" button hides
 *   - subsequent calls are no-ops
 *   - failures don't loop the caller (exhausted regardless)
 *   - non-overridden methods pass straight through to widgetApi
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWidgetReadAdapter } from '../widget/widgetReadAdapter.js';

function makeWidgetApi(stub = {}) {
  return {
    receiveRoomEvents: vi.fn().mockResolvedValue([]),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$state-evt' }),
    sendRoomEvent: vi.fn().mockResolvedValue({ event_id: '$room-evt' }),
    observeStateEvents: vi.fn(),
    widgetParameters: { userId: '@alice:example.org' },
    ...stub,
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('createWidgetReadAdapter', () => {
  it('shapes receiveRoomEvents results like MatrixApiAdapter.getMessages chunks', async () => {
    const widgetApi = makeWidgetApi({
      receiveRoomEvents: vi.fn().mockResolvedValue([
        { event_id: '$a', type: 'm.room.message', sender: '@a:s', content: { msgtype: 'm.text', body: 'hi' }, origin_server_ts: 1 },
        { event_id: '$b', type: 'm.room.message', sender: '@b:s', content: { msgtype: 'm.text', body: 'ho' }, origin_server_ts: 2 },
      ]),
    });
    const adapter = createWidgetReadAdapter(widgetApi);

    const result = await adapter.getMessages(50);

    expect(widgetApi.receiveRoomEvents).toHaveBeenCalledWith('m.room.message', { messageType: 'm.text' });
    expect(result.chunk).toHaveLength(2);
    expect(result.chunk[0]).toEqual({
      event_id: '$a', type: 'm.room.message', sender: '@a:s',
      content: { msgtype: 'm.text', body: 'hi' }, origin_server_ts: 1,
    });
    expect(result.end).toBeNull();
  });

  it('keeps the most recent `limit` events when receiveRoomEvents returns more', async () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      event_id: `$evt-${i}`, type: 'm.room.message',
      sender: '@a:s', content: { msgtype: 'm.text', body: String(i) },
      origin_server_ts: i,
    }));
    const widgetApi = makeWidgetApi({ receiveRoomEvents: vi.fn().mockResolvedValue(events) });
    const adapter = createWidgetReadAdapter(widgetApi);

    const result = await adapter.getMessages(5);

    expect(result.chunk).toHaveLength(5);
    expect(result.chunk.map((e) => e.event_id)).toEqual(['$evt-15', '$evt-16', '$evt-17', '$evt-18', '$evt-19']);
  });

  it('flips hasMoreHistory to false after the first call', async () => {
    const widgetApi = makeWidgetApi();
    const adapter = createWidgetReadAdapter(widgetApi);

    expect(adapter.hasMoreHistory).toBe(true);
    await adapter.getMessages(100);
    expect(adapter.hasMoreHistory).toBe(false);
  });

  it('returns empty on subsequent calls without hitting receiveRoomEvents again', async () => {
    const widgetApi = makeWidgetApi();
    const adapter = createWidgetReadAdapter(widgetApi);

    await adapter.getMessages(100);
    await adapter.getMessages(100);

    expect(widgetApi.receiveRoomEvents).toHaveBeenCalledTimes(1);
  });

  it('swallows receiveRoomEvents errors and stops paginating', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const widgetApi = makeWidgetApi({
      receiveRoomEvents: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const adapter = createWidgetReadAdapter(widgetApi);

    const result = await adapter.getMessages(100);

    expect(result).toEqual({ chunk: [], end: null });
    expect(adapter.hasMoreHistory).toBe(false);
    warnSpy.mockRestore();
  });

  it('proxies non-overridden methods straight through to widgetApi', async () => {
    const widgetApi = makeWidgetApi();
    const adapter = createWidgetReadAdapter(widgetApi);

    const result = await adapter.sendStateEvent('com.vtt.token', { x: 1 }, { stateKey: 'tok' });
    expect(widgetApi.sendStateEvent).toHaveBeenCalledWith('com.vtt.token', { x: 1 }, { stateKey: 'tok' });
    expect(result).toEqual({ event_id: '$state-evt' });
  });

  it('proxies non-function properties (e.g. widgetParameters) straight through', () => {
    const widgetApi = makeWidgetApi();
    const adapter = createWidgetReadAdapter(widgetApi);
    expect(adapter.widgetParameters).toEqual({ userId: '@alice:example.org' });
  });
});
