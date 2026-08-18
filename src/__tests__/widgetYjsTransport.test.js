/**
 * Widget-mode Yjs transport.
 *
 * The live Yjs transport only existed inside MatrixApiAdapter, which
 * widget mode no longer uses, so a widget client could never send or
 * receive CRDT updates: the GM's wizard "saved" into a local doc that
 * never reached the room, and players never saw entity state.
 * attachWidgetYjs runs the same YjsMatrixTransport over the widget API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachWidgetYjs } from '../widget/widget-yjs.js';
import { YJS_EVENT_TYPES } from '../utils/constants.js';

function makeYjsManager() {
  const updateHandlers = [];
  return {
    onUpdate: vi.fn((fn) => updateHandlers.push(fn)),
    emitUpdate: (u) => updateHandlers.forEach((fn) => fn(u)),
    getStateVector: vi.fn(() => new Uint8Array([1, 2])),
    handleMatrixUpdate: vi.fn(),
    compareStateVector: vi.fn(),
  };
}

function makeWm() {
  const subscriptions = new Map();
  return {
    userId: '@gm:mozilla.org',
    roomId: '!room:mozilla.org',
    sendRoomEvent: vi.fn().mockResolvedValue({}),
    widgetApi: {
      observeRoomEvents: vi.fn((type) => ({
        subscribe: (observer) => {
          subscriptions.set(type, typeof observer === 'function' ? observer : observer.next);
          return { unsubscribe: vi.fn() };
        },
      })),
    },
    _emit: (type, event) => subscriptions.get(type)?.(event),
  };
}

describe('attachWidgetYjs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends local Yjs updates as widget room events', async () => {
    const wm = makeWm();
    const yjs = makeYjsManager();
    const transport = attachWidgetYjs(/** @type {any} */ (wm), /** @type {any} */ (yjs));

    yjs.emitUpdate(new Uint8Array([7, 8, 9]));
    await vi.advanceTimersByTimeAsync(400);

    expect(wm.sendRoomEvent).toHaveBeenCalled();
    const [type, content] = wm.sendRoomEvent.mock.calls[0];
    expect(type).toBe(YJS_EVENT_TYPES.UPDATE);
    expect(content.total).toBe(1);
    expect(typeof content.data).toBe('string');

    transport.destroy();
  });

  it('routes incoming update events into the Yjs manager', () => {
    const wm = makeWm();
    const yjs = makeYjsManager();
    const transport = attachWidgetYjs(/** @type {any} */ (wm), /** @type {any} */ (yjs));

    wm._emit(YJS_EVENT_TYPES.UPDATE, {
      type: YJS_EVENT_TYPES.UPDATE,
      content: { seq: 's1', idx: 0, total: 1, data: btoa('') },
      origin_server_ts: 123,
    });

    expect(yjs.handleMatrixUpdate).toHaveBeenCalledTimes(1);
    transport.destroy();
  });

  it('routes incoming sync vectors into divergence detection', () => {
    const wm = makeWm();
    const yjs = makeYjsManager();
    const transport = attachWidgetYjs(/** @type {any} */ (wm), /** @type {any} */ (yjs));

    wm._emit(YJS_EVENT_TYPES.SYNC_VECTOR, {
      type: YJS_EVENT_TYPES.SYNC_VECTOR,
      content: { vector: btoa('') },
    });

    expect(yjs.compareStateVector).toHaveBeenCalledTimes(1);
    transport.destroy();
  });

  it('is idempotent per manager', () => {
    const wm = makeWm();
    const yjs = makeYjsManager();
    const first = attachWidgetYjs(/** @type {any} */ (wm), /** @type {any} */ (yjs));
    const second = attachWidgetYjs(/** @type {any} */ (wm), /** @type {any} */ (yjs));

    expect(second).toBe(null);
    first.destroy();
  });
});
