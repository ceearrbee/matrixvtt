/**
 * Send-failure durability of the Yjs transport: rate-limited updates
 * must be buffered, surfaced to the user, retried, and survive a
 * transport teardown via sessionStorage. Permanent failures must be
 * reported, not silently logged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YjsManager, YJS_EVENT_TYPES } from '../YjsManager.js';
import { YjsMatrixTransport } from '../../client/YjsMatrixTransport.js';
import { VTT_EVENTS } from '../../utils/constants.js';

const roomId = '!durability:test';

const rateLimitError = (retryAfterMs) => Object.assign(new Error('limited'), {
  errcode: 'M_LIMIT_EXCEEDED',
  ...(retryAfterMs ? { data: { retry_after_ms: retryAfterMs } } : {}),
});

function collectEvents(type) {
  const events = [];
  const handler = (e) => events.push(e.detail ?? null);
  window.addEventListener(type, handler);
  return { events, cleanup: () => window.removeEventListener(type, handler) };
}

function updateSends(client) {
  return client.sendVTTEvent.mock.calls.filter(([, type]) => type === YJS_EVENT_TYPES.UPDATE);
}

describe('YjsMatrixTransport durability', () => {
  let managerA, managerB, clientA, clientB, transportA, transportB;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();

    managerA = new YjsManager(roomId);
    managerB = new YjsManager(roomId);
    clientA = { userId: '@alice:m.org', status: 'connected', sendVTTEvent: vi.fn() };
    clientB = { userId: '@bob:m.org', status: 'connected', sendVTTEvent: vi.fn().mockResolvedValue({}) };
    transportA = new YjsMatrixTransport(clientA, managerA, roomId);
    transportB = new YjsMatrixTransport(clientB, managerB, roomId);

    clientB.sendVTTEvent.mockImplementation(async (rid, type, key, content) => {
      await Promise.resolve();
      transportA.handleIncomingEvent({ type, content, origin_server_ts: Date.now() });
      return {};
    });
  });

  afterEach(() => {
    transportA.destroy();
    transportB.destroy();
    managerA.destroy();
    managerB.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('buffers a rate-limited update, surfaces it, and delivers after recovery', async () => {
    let failuresLeft = 2;
    clientA.sendVTTEvent.mockImplementation(async (rid, type, key, content) => {
      if (type !== YJS_EVENT_TYPES.UPDATE) return {};
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw rateLimitError(1000);
      }
      await Promise.resolve();
      transportB.handleIncomingEvent({ type, content, origin_server_ts: Date.now() });
      return {};
    });

    const pending = collectEvents(VTT_EVENTS.QUEUE_PENDING);
    const rateLimited = collectEvents(VTT_EVENTS.RATE_LIMITED);
    const empty = collectEvents(VTT_EVENTS.QUEUE_EMPTY);

    managerA.tokensMap.set('t1', { x: 10, y: 10 });
    await vi.advanceTimersByTimeAsync(300);

    expect(managerB.tokensMap.get('t1')).toBeUndefined();
    expect(pending.events.some((d) => d?.source === 'yjs' && d?.count >= 1)).toBe(true);
    expect(rateLimited.events.some((d) => d?.source === 'yjs' && d?.retryAfterMs === 1000)).toBe(true);

    await vi.advanceTimersByTimeAsync(30000);

    expect(managerB.tokensMap.get('t1')).toEqual({ x: 10, y: 10 });
    expect(empty.events.some((d) => d?.source === 'yjs')).toBe(true);

    pending.cleanup(); rateLimited.cleanup(); empty.cleanup();
  });

  it('reports permanent send failures instead of silently dropping', async () => {
    clientA.sendVTTEvent.mockImplementation(async (rid, type) => {
      if (type !== YJS_EVENT_TYPES.UPDATE) return {};
      throw Object.assign(new Error('forbidden'), { status: 403 });
    });

    const errors = collectEvents(VTT_EVENTS.ERROR);

    managerA.tokensMap.set('t1', { x: 1, y: 1 });
    await vi.advanceTimersByTimeAsync(300);

    expect(errors.events.length).toBe(1);
    expect(errors.events[0].message).toMatch(/sync|change/i);

    const callsAfterFailure = updateSends(clientA).length;
    await vi.advanceTimersByTimeAsync(20000);
    expect(updateSends(clientA).length).toBe(callsAfterFailure);

    errors.cleanup();
  });

  it('persists buffered updates across a transport teardown and rebroadcasts them', async () => {
    clientA.sendVTTEvent.mockImplementation(async (rid, type) => {
      if (type !== YJS_EVENT_TYPES.UPDATE) return {};
      throw rateLimitError(1000);
    });

    managerA.tokensMap.set('t2', { x: 5, y: 5 });
    await vi.advanceTimersByTimeAsync(300);
    expect(managerB.tokensMap.get('t2')).toBeUndefined();

    transportA.destroy();
    managerA.destroy();

    const managerA2 = new YjsManager(roomId);
    const clientA2 = { userId: '@alice:m.org', status: 'connected', sendVTTEvent: vi.fn() };
    clientA2.sendVTTEvent.mockImplementation(async (rid, type, key, content) => {
      await Promise.resolve();
      transportB.handleIncomingEvent({ type, content, origin_server_ts: Date.now() });
      return {};
    });
    const transportA2 = new YjsMatrixTransport(clientA2, managerA2, roomId);

    transportA = transportA2;
    managerA = managerA2;

    transportA2.restorePersistedPending();
    expect(managerA2.tokensMap.get('t2')).toEqual({ x: 5, y: 5 });

    await vi.advanceTimersByTimeAsync(300);
    expect(managerB.tokensMap.get('t2')).toEqual({ x: 5, y: 5 });
  });

  it('broadcasts the first sync vector ~5s after construction, then every 60s +/- 15s', async () => {
    const vectorSends = () =>
      clientB.sendVTTEvent.mock.calls.filter(([, type]) => type === YJS_EVENT_TYPES.SYNC_VECTOR).length;

    await vi.advanceTimersByTimeAsync(4900);
    expect(vectorSends()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(vectorSends()).toBe(1);

    // The next broadcast lands between +45s and +75s after the first.
    await vi.advanceTimersByTimeAsync(44_700);
    expect(vectorSends()).toBe(1);
    await vi.advanceTimersByTimeAsync(30_500);
    expect(vectorSends()).toBe(2);
  });

  it('drains the offline buffer through the durable path on reconnect', async () => {
    clientA.status = 'disconnected';
    const statusListeners = [];
    clientA.onStatusUpdate = (cb) => { statusListeners.push(cb); return () => {}; };

    const transport = new YjsMatrixTransport(clientA, managerA, roomId);
    clientA.sendVTTEvent.mockImplementation(async (rid, type, key, content) => {
      await Promise.resolve();
      transportB.handleIncomingEvent({ type, content, origin_server_ts: Date.now() });
      return {};
    });

    try {
      managerA.tokensMap.set('offline-edit', { x: 9 });
      await vi.advanceTimersByTimeAsync(300);
      expect(managerB.tokensMap.get('offline-edit')).toBeUndefined();

      clientA.status = 'connected';
      for (const cb of statusListeners) cb('connected');
      await vi.advanceTimersByTimeAsync(300);

      expect(managerB.tokensMap.get('offline-edit')).toEqual({ x: 9 });
    } finally {
      transport.destroy();
    }
  });
});
