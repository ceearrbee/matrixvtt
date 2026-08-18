/**
 * MatrixClient - direct coverage of the 420-line matrix-js-sdk
 * wrapper. The SDK is mocked at module level; tests construct
 * `new MatrixClient(...)` and drive it through its public surface.
 *
 * Layers covered:
 *   - lifecycle / status state machine
 *   - status listeners + disposer
 *   - auth-error promotion (Session.logged_out, 401/403 from send)
 *   - sendVTTEvent gating
 *   - coalesce throttle (TOKEN) and stream throttle (DRAWING)
 *   - room-method passthroughs + their mapping logic
 *
 * Out of scope: static auth helpers (login / loginWithToken / SSO),
 * covered indirectly by standaloneAuth.test.js.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── matrix-js-sdk mock ─────────────────────────────────────────────────────
//
// One stub client instance per test; `vi.mock` runs once at module load
// and returns a fresh client from each `createClient` call so tests can
// keep their own handle. The factory and the created clients are reset
// in `beforeEach`.
const __mockClients = [];
let __createClientImpl = null;

vi.mock('matrix-js-sdk', () => {
  function makeMockClient() {
    const handlers = new Map();
    const client = {
      __handlers: handlers,
      on: vi.fn((name, fn) => {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(fn);
      }),
      fire(name, ...args) {
        (handlers.get(name) || []).forEach((fn) => fn(...args));
      },
      startClient: vi.fn().mockResolvedValue(undefined),
      stopClient: vi.fn().mockResolvedValue(undefined),
      sendEvent: vi.fn().mockResolvedValue({ event_id: '$ev' }),
      sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$st' }),
      getStateEvent: vi.fn().mockResolvedValue({}),
      getJoinedRooms: vi.fn().mockResolvedValue({ joined_rooms: ['!a:s', '!b:s'] }),
      joinRoom: vi.fn().mockResolvedValue({ roomId: '!a:s' }),
      leave: vi.fn().mockResolvedValue(undefined),
      forget: vi.fn().mockResolvedValue(undefined),
      roomState: vi.fn().mockResolvedValue([]),
      getProfileInfo: vi.fn().mockResolvedValue({ displayname: 'Alice' }),
      logout: vi.fn().mockResolvedValue({}),
      createRoom: vi.fn().mockResolvedValue({ room_id: '!new:s' }),
      getRoomIdForAlias: vi.fn().mockResolvedValue({ room_id: '!alias:s' }),
      getJoinedRoomMembers: vi.fn().mockResolvedValue({
        joined: {
          '@a:s': { display_name: 'Alice' },
          '@b:s': { display_name: null },
        },
      }),
      upgradeRoom: vi.fn().mockResolvedValue({ replacement_room: '!upgraded:s' }),
      knockRoom: vi.fn().mockResolvedValue({ room_id: '!knock:s' }),
      http: {
        authedRequest: vi.fn().mockResolvedValue({}),
      },
    };
    return client;
  }

  return {
    createClient: vi.fn((opts) => {
      const c = __createClientImpl ? __createClientImpl(opts) : makeMockClient();
      __mockClients.push(c);
      return c;
    }),
    Preset: { PrivateChat: 'private_chat' },
    AutoDiscovery: { findClientConfig: vi.fn().mockResolvedValue(null) },
  };
});

import { MatrixClient, CLIENT_STATUS } from '../client/MatrixClient.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

function makeClient(opts = {}) {
  const c = new MatrixClient({
    homeserver: 'matrix.example.org',
    accessToken: 'tok',
    userId: '@me:s',
    ...opts,
  });
  return { client: c, sdk: __mockClients[__mockClients.length - 1] };
}

beforeEach(() => {
  __mockClients.length = 0;
  __createClientImpl = null;
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────

describe('lifecycle', () => {
  it('start() flips CONNECTING then CONNECTED on sync PREPARED', async () => {
    const { client, sdk } = makeClient();
    const startP = client.start();
    expect(client.status).toBe(CLIENT_STATUS.CONNECTING);
    sdk.fire('sync', 'PREPARED', null, {});
    await startP;
    expect(client.status).toBe(CLIENT_STATUS.CONNECTED);
  });

  it('sync ERROR moves to OFFLINE', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'ERROR', 'PREPARED', {});
    expect(client.status).toBe(CLIENT_STATUS.OFFLINE);
  });

  it('sync RECONNECTING moves back to CONNECTING', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    sdk.fire('sync', 'RECONNECTING', 'PREPARED', {});
    expect(client.status).toBe(CLIENT_STATUS.CONNECTING);
  });

  it('start() failure sets OFFLINE and rethrows', async () => {
    const { client, sdk } = makeClient();
    sdk.startClient.mockRejectedValue(new Error('boom'));
    await expect(client.start()).rejects.toThrow('boom');
    expect(client.status).toBe(CLIENT_STATUS.OFFLINE);
  });

  it('stop() stops the SDK, nulls it, and sets DISCONNECTED', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    await client.stop();
    expect(sdk.stopClient).toHaveBeenCalled();
    expect(client.sdk).toBeNull();
    expect(client.status).toBe(CLIENT_STATUS.DISCONNECTED);
  });
});

// ─── Status listeners ───────────────────────────────────────────────────────

describe('status listeners', () => {
  it('invokes the callback synchronously with the current status', () => {
    const { client } = makeClient();
    const cb = vi.fn();
    client.onStatusUpdate(cb);
    expect(cb).toHaveBeenCalledWith(CLIENT_STATUS.DISCONNECTED);
  });

  it('fires every subscriber on each status change', async () => {
    const { client, sdk } = makeClient();
    const a = vi.fn(); const b = vi.fn();
    client.onStatusUpdate(a); client.onStatusUpdate(b);
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    expect(a).toHaveBeenCalledWith(CLIENT_STATUS.CONNECTING);
    expect(a).toHaveBeenCalledWith(CLIENT_STATUS.CONNECTED);
    expect(b).toHaveBeenCalledWith(CLIENT_STATUS.CONNECTING);
    expect(b).toHaveBeenCalledWith(CLIENT_STATUS.CONNECTED);
  });

  it('the returned disposer unsubscribes', async () => {
    const { client } = makeClient();
    const cb = vi.fn();
    const dispose = client.onStatusUpdate(cb);
    cb.mockClear();
    dispose();
    await client.start();
    expect(cb).not.toHaveBeenCalled();
  });
});

// ─── Auth error promotion ───────────────────────────────────────────────────

describe('auth error', () => {
  it('Session.logged_out with M_UNKNOWN_TOKEN flips to AUTH_ERROR and emits VTT_EVENTS.ERROR', async () => {
    const { client, sdk } = makeClient();
    const errEvents = [];
    const handler = (e) => errEvents.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, handler);
    try {
      await client.start();
      sdk.fire('Session.logged_out', { data: { errcode: 'M_UNKNOWN_TOKEN' } });
      expect(client.status).toBe(CLIENT_STATUS.AUTH_ERROR);
      expect(errEvents).toHaveLength(1);
      expect(errEvents[0].code).toBe('AUTH_ERROR');
    } finally {
      window.removeEventListener(VTT_EVENTS.ERROR, handler);
    }
  });

  it('Session.logged_out without M_UNKNOWN_TOKEN is ignored', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    sdk.fire('Session.logged_out', { data: { errcode: 'M_LIMIT_EXCEEDED' } });
    expect(client.status).toBe(CLIENT_STATUS.CONNECTED);
  });

  it('401 from sendVTTEvent triggers the auth-error path and rethrows', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    const errEvents = [];
    const handler = (e) => errEvents.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, handler);
    try {
      const err = Object.assign(new Error('unauthorised'), { httpStatus: 401 });
      sdk.sendEvent.mockRejectedValueOnce(err);
      await expect(client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, null, {})).rejects.toThrow('unauthorised');
      // _handleAuthError emits the VTT error event; status briefly flips
      // to AUTH_ERROR before stop() cascades it to DISCONNECTED.
      expect(errEvents.some((d) => d.code === 'AUTH_ERROR')).toBe(true);
    } finally {
      window.removeEventListener(VTT_EVENTS.ERROR, handler);
    }
  });

  it('403 M_FORBIDDEN (power levels) does NOT kill the session', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    const errEvents = [];
    const handler = (e) => errEvents.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, handler);
    try {
      const err = Object.assign(new Error('user_level (0) < send_level (50)'), {
        httpStatus: 403, errcode: 'M_FORBIDDEN',
      });
      sdk.sendStateEvent.mockRejectedValueOnce(err);
      await expect(client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, '', {})).rejects.toThrow('send_level');
      expect(errEvents.some((d) => d.code === 'AUTH_ERROR')).toBe(false);
      expect(client.status).toBe(CLIENT_STATUS.CONNECTED);
    } finally {
      window.removeEventListener(VTT_EVENTS.ERROR, handler);
    }
  });

  it('403 with M_UNKNOWN_TOKEN still triggers the auth-error path', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    const errEvents = [];
    const handler = (e) => errEvents.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, handler);
    try {
      const err = Object.assign(new Error('token expired'), {
        httpStatus: 403, errcode: 'M_UNKNOWN_TOKEN',
      });
      sdk.sendStateEvent.mockRejectedValueOnce(err);
      await expect(client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, '', {})).rejects.toThrow('token expired');
      expect(errEvents.some((d) => d.code === 'AUTH_ERROR')).toBe(true);
    } finally {
      window.removeEventListener(VTT_EVENTS.ERROR, handler);
    }
  });
});

// ─── sendVTTEvent dispatch ──────────────────────────────────────────────────

describe('sendVTTEvent dispatch', () => {
  it('throws when not CONNECTED', async () => {
    const { client } = makeClient();
    await expect(client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, '', {})).rejects.toThrow(/status/);
  });

  it('routes untyped events with a stateKey through sendStateEvent', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, '', { a: 1 });
    expect(sdk.sendStateEvent).toHaveBeenCalledWith('!r:s', EVENT_TYPES.SETTINGS, { a: 1 }, '');
    expect(sdk.sendEvent).not.toHaveBeenCalled();
  });

  it('routes untyped events without a stateKey through sendEvent', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, null, { b: 2 });
    expect(sdk.sendEvent).toHaveBeenCalledWith('!r:s', EVENT_TYPES.SETTINGS, { b: 2 });
  });

  it('rethrows non-auth send errors', async () => {
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    sdk.sendEvent.mockRejectedValueOnce(new Error('network'));
    await expect(client.sendVTTEvent('!r:s', EVENT_TYPES.SETTINGS, null, {})).rejects.toThrow('network');
    expect(client.status).toBe(CLIENT_STATUS.CONNECTED);
  });
});

// ─── Coalesce throttle (tokens) ─────────────────────────────────────────────

describe('coalesce throttle', () => {
  it('keeps the latest write per (room, type, stateKey)', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 1 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 5 });
    await vi.advanceTimersByTimeAsync(450);
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(1);
    const [, , content] = sdk.sendStateEvent.mock.calls[0];
    expect(content.col).toBe(5);
  });

  it('stamps _v as a monotonically increasing logical clock', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 1 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-2', { col: 2 });
    await vi.advanceTimersByTimeAsync(450);
    const v1 = sdk.sendStateEvent.mock.calls[0][2]._v;
    const v2 = sdk.sendStateEvent.mock.calls[1][2]._v;
    expect(typeof v1).toBe('number');
    expect(v2).toBeGreaterThan(v1);
  });

  it('flushes one event per distinct stateKey', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 1 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-2', { col: 2 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 9 });
    await vi.advanceTimersByTimeAsync(450);
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(2);
  });

  it('schedules only one flush timer per burst', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 1 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 2 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.TOKEN, 'tok-1', { col: 3 });
    // 400ms delay - single timer should drain after one advance.
    await vi.advanceTimersByTimeAsync(400);
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(1);
    expect(sdk.sendStateEvent.mock.calls[0][2].col).toBe(3);
  });
});

// ─── Stream throttle (drawings) ─────────────────────────────────────────────

describe('stream throttle', () => {
  it('drains one entry per interval tick', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.DRAWING, 'd1', { pts: 1 });
    await client.sendVTTEvent('!r:s', EVENT_TYPES.DRAWING, 'd2', { pts: 2 });
    await vi.advanceTimersByTimeAsync(120);
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120);
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(2);
  });

  it('stops the interval when the queue empties', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.DRAWING, 'd1', {});
    await vi.advanceTimersByTimeAsync(120);
    await vi.advanceTimersByTimeAsync(120); // queue now empty; interval should clear
    sdk.sendStateEvent.mockClear();
    await vi.advanceTimersByTimeAsync(500);
    expect(sdk.sendStateEvent).not.toHaveBeenCalled();
  });

  it('drops the oldest entry once maxQueue is reached', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    // 50 = maxQueue. Enqueue 51 to force one drop.
    for (let i = 0; i < 51; i++) {
      await client.sendVTTEvent('!r:s', EVENT_TYPES.DRAWING, `d${i}`, { i });
    }
    // Drain everything.
    await vi.advanceTimersByTimeAsync(120 * 60);
    // 51 enqueued − 1 dropped = 50 sent. First call's content should not be d0.
    expect(sdk.sendStateEvent).toHaveBeenCalledTimes(50);
    expect(sdk.sendStateEvent.mock.calls[0][2].i).toBe(1);
  });

  it('preserves the stateKey on each streamed call', async () => {
    vi.useFakeTimers();
    const { client, sdk } = makeClient();
    await client.start();
    sdk.fire('sync', 'PREPARED', null, {});
    await client.sendVTTEvent('!r:s', EVENT_TYPES.DRAWING, 'd1', {});
    await vi.advanceTimersByTimeAsync(120);
    expect(sdk.sendStateEvent).toHaveBeenCalledWith('!r:s', EVENT_TYPES.DRAWING, {}, 'd1');
  });
});

// ─── Room methods ───────────────────────────────────────────────────────────

describe('room methods', () => {
  it('getJoinedRooms unwraps joined_rooms', async () => {
    const { client } = makeClient();
    await expect(client.getJoinedRooms()).resolves.toEqual(['!a:s', '!b:s']);
  });

  it('joinRoom returns the SDK roomId', async () => {
    const { client } = makeClient();
    await expect(client.joinRoom('#alias:s')).resolves.toBe('!a:s');
  });

  it('joinRoom passes a via hint derived from a bare room ID', async () => {
    const { client, sdk } = makeClient();
    await client.joinRoom('!YjgXXmPmvVhdbIAoqp:matrix.org');
    expect(sdk.joinRoom).toHaveBeenCalledWith('!YjgXXmPmvVhdbIAoqp:matrix.org', {
      viaServers: ['matrix.org'],
    });
  });

  it('joinRoom keeps the port when the room ID domain has one', async () => {
    const { client, sdk } = makeClient();
    await client.joinRoom('!abc:server.example:8448');
    expect(sdk.joinRoom).toHaveBeenCalledWith('!abc:server.example:8448', {
      viaServers: ['server.example:8448'],
    });
  });

  it('joinRoom sends no via hint for aliases (the alias lookup routes)', async () => {
    const { client, sdk } = makeClient();
    await client.joinRoom('#alias:s');
    expect(sdk.joinRoom).toHaveBeenCalledWith('#alias:s', undefined);
  });

  it('leaveRoom calls leave then forget; swallows forget errors', async () => {
    const { client, sdk } = makeClient();
    sdk.forget.mockRejectedValueOnce(new Error('forget failed'));
    await expect(client.leaveRoom('!r:s')).resolves.toBeUndefined();
    expect(sdk.leave).toHaveBeenCalledWith('!r:s');
    expect(sdk.forget).toHaveBeenCalledWith('!r:s');
  });

  it('getRoomName returns the room name when present', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockResolvedValueOnce({ name: 'Cool Room' });
    await expect(client.getRoomName('!r:s')).resolves.toBe('Cool Room');
  });

  it('getRoomName falls back to roomId when the SDK throws', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockRejectedValueOnce(new Error('forbidden'));
    await expect(client.getRoomName('!r:s')).resolves.toBe('!r:s');
  });

  it('getVttState returns the SDK payload on success', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockResolvedValueOnce({ campaign_name: 'foo' });
    await expect(client.getVttState('!r:s')).resolves.toEqual({ campaign_name: 'foo' });
  });

  it('getVttState returns null when the SDK throws', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockRejectedValueOnce(new Error('404'));
    await expect(client.getVttState('!r:s')).resolves.toBeNull();
  });

  it('getInvitedRooms maps invite_state events to a friendly shape', async () => {
    const { client, sdk } = makeClient();
    sdk.http.authedRequest.mockResolvedValueOnce({
      rooms: {
        invite: {
          '!inv:s': {
            invite_state: {
              events: [
                { type: 'm.room.name', content: { name: 'Party' } },
                { type: 'm.room.member', sender: '@gm:s', state_key: '@me:s' },
                { type: 'm.room.member', sender: '@gm:s', state_key: '@gm:s', content: { displayname: 'Game Master' } },
              ],
            },
          },
        },
      },
    });
    const invs = await client.getInvitedRooms();
    expect(invs).toEqual([{ roomId: '!inv:s', name: 'Party', inviter: '@gm:s' }]);
  });

  it('getProfile passes through', async () => {
    const { client, sdk } = makeClient();
    await expect(client.getProfile('@a:s')).resolves.toEqual({ displayname: 'Alice' });
    expect(sdk.getProfileInfo).toHaveBeenCalledWith('@a:s');
  });

  it('logout passes through', async () => {
    const { client, sdk } = makeClient();
    await client.logout();
    expect(sdk.logout).toHaveBeenCalled();
  });

  it('createRoom returns room_id and uses PrivateChat preset', async () => {
    const { client, sdk } = makeClient();
    await expect(client.createRoom('My Game')).resolves.toBe('!new:s');
    expect(sdk.createRoom).toHaveBeenCalledWith({ name: 'My Game', preset: 'private_chat' });
  });

  it('resolveRoomAlias returns room_id', async () => {
    const { client } = makeClient();
    await expect(client.resolveRoomAlias('#alias:s')).resolves.toBe('!alias:s');
  });

  it('getRoomMembers maps joined object to an array', async () => {
    const { client } = makeClient();
    const members = await client.getRoomMembers('!r:s');
    expect(members).toEqual([
      { userId: '@a:s', displayname: 'Alice' },
      { userId: '@b:s', displayname: '@b:s' }, // null display_name falls back to userId
    ]);
  });

  it('setRoomDisplayName merges the existing member event', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockResolvedValueOnce({ avatar_url: 'mxc://x', membership: 'join' });
    await client.setRoomDisplayName('!r:s', 'Bob');
    expect(sdk.sendStateEvent).toHaveBeenCalledWith(
      '!r:s',
      'm.room.member',
      { avatar_url: 'mxc://x', membership: 'join', displayname: 'Bob' },
      '@me:s',
    );
  });

  it('setRoomDisplayName tolerates a missing existing member event', async () => {
    const { client, sdk } = makeClient();
    sdk.getStateEvent.mockRejectedValueOnce(new Error('not found'));
    await client.setRoomDisplayName('!r:s', 'Bob');
    expect(sdk.sendStateEvent).toHaveBeenCalledWith(
      '!r:s',
      'm.room.member',
      { membership: 'join', displayname: 'Bob' },
      '@me:s',
    );
  });

  it('upgradeRoom returns replacement_room', async () => {
    const { client } = makeClient();
    await expect(client.upgradeRoom('!r:s', '11')).resolves.toBe('!upgraded:s');
  });

  it('knockRoom returns room_id from the SDK', async () => {
    const { client } = makeClient();
    await expect(client.knockRoom('!r:s', 'why not')).resolves.toBe('!knock:s');
  });

  it('knockRoom passes the reason and a via hint from the room ID', async () => {
    const { client, sdk } = makeClient();
    await client.knockRoom('!r:s', 'why not');
    expect(sdk.knockRoom).toHaveBeenCalledWith('!r:s', {
      reason: 'why not',
      viaServers: ['s'],
    });
  });

  it('knockRoom falls back to the input roomId when the SDK omits room_id', async () => {
    const { client, sdk } = makeClient();
    sdk.knockRoom.mockResolvedValueOnce({});
    await expect(client.knockRoom('!r:s')).resolves.toBe('!r:s');
  });
});
