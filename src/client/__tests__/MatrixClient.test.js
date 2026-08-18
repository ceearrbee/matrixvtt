import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as sdk from 'matrix-js-sdk';
import { MatrixClient, CLIENT_STATUS } from '../MatrixClient.js';
import { EVENT_TYPES } from '../../utils/constants.js';

vi.mock('matrix-js-sdk', () => {
  const Preset = { PrivateChat: 'private_chat' };
  const mockClient = {
    on: vi.fn(),
    startClient: vi.fn().mockResolvedValue({}),
    stopClient: vi.fn().mockResolvedValue({}),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$1' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$2' }),
    getCapabilities: vi.fn().mockResolvedValue({}),
    getJoinedRooms: vi.fn().mockResolvedValue({ joined_rooms: [] }),
    joinRoom: vi.fn().mockResolvedValue({ roomId: '!r:m' }),
    leave: vi.fn().mockResolvedValue({}),
    forget: vi.fn().mockResolvedValue({}),
    roomState: vi.fn().mockResolvedValue([]),
    getStateEvent: vi.fn().mockResolvedValue({}),
    getProfileInfo: vi.fn().mockResolvedValue({ displayname: 'Alice' }),
    logout: vi.fn().mockResolvedValue({}),
    createRoom: vi.fn().mockResolvedValue({ room_id: '!new:m' }),
    getRoomIdForAlias: vi.fn().mockResolvedValue({ room_id: '!alias:m', servers: [] }),
    getJoinedRoomMembers: vi.fn().mockResolvedValue({ joined: {} }),
    upgradeRoom: vi.fn().mockResolvedValue({ replacement_room: '!new2:m' }),
    knockRoom: vi.fn().mockResolvedValue({ room_id: '!r:m' }),
  };
  return {
    createClient: vi.fn(() => mockClient),
    request: vi.fn(),
    Preset,
  };
});

describe('MatrixClient (Refactored)', () => {
  let client;
  const credentials = {
    homeserver: 'https://matrix.org',
    accessToken: 's3cret',
    userId: '@alice:matrix.org',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    client = new MatrixClient(credentials);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with DISCONNECTED status', () => {
    expect(client.status).toBe(CLIENT_STATUS.DISCONNECTED);
  });

  it('transitions to CONNECTED on successful start', async () => {
    const startPromise = client.start();
    expect(client.status).toBe(CLIENT_STATUS.CONNECTING);

    const mockSdk = sdk.createClient();
    const syncCallback = mockSdk.on.mock.calls.find(call => call[0] === 'sync')[1];
    
    syncCallback('PREPARED');
    await startPromise;

    expect(client.status).toBe(CLIENT_STATUS.CONNECTED);
    expect(mockSdk.startClient).toHaveBeenCalled();
  });

  it('handles auth errors (M_UNKNOWN_TOKEN)', async () => {
    await client.start();
    const mockSdk = sdk.createClient();
    const logoutCallback = mockSdk.on.mock.calls.find(call => call[0] === 'Session.logged_out')[1];

    logoutCallback({ data: { errcode: 'M_UNKNOWN_TOKEN' } });

    expect(client.status).toBe(CLIENT_STATUS.AUTH_ERROR);
    expect(mockSdk.stopClient).toHaveBeenCalled();
  });

  describe('Throttling: Coalescing (Tokens)', () => {
    beforeEach(async () => {
      // Mock being connected
      await client.start();
      const mockSdk = sdk.createClient();
      const syncCallback = mockSdk.on.mock.calls.find(call => call[0] === 'sync')[1];
      syncCallback('PREPARED');
    });

    it('coalesces multiple token updates into one send', async () => {
      const mockSdk = sdk.createClient();
      const roomId = '!room:id';
      const type = EVENT_TYPES.TOKEN;
      const stateKey = 'token1';

      // Send 3 updates rapidly
      client.sendVTTEvent(roomId, type, stateKey, { x: 1 });
      client.sendVTTEvent(roomId, type, stateKey, { x: 2 });
      client.sendVTTEvent(roomId, type, stateKey, { x: 3 });

      expect(mockSdk.sendStateEvent).not.toHaveBeenCalled();

      // Wait for throttle delay
      await vi.advanceTimersByTimeAsync(400);

      // Should only call sendStateEvent once with the LATEST content and a version tag
      expect(mockSdk.sendStateEvent).toHaveBeenCalledTimes(1);
      expect(mockSdk.sendStateEvent).toHaveBeenCalledWith(roomId, type, { x: 3, _v: 3 }, stateKey);
    });

    it('separates coalescing by stateKey', async () => {
      const mockSdk = sdk.createClient();
      const roomId = '!room:id';
      const type = EVENT_TYPES.TOKEN;

      client.sendVTTEvent(roomId, type, 't1', { x: 1 });
      client.sendVTTEvent(roomId, type, 't2', { x: 10 });
      client.sendVTTEvent(roomId, type, 't1', { x: 2 });

      await vi.advanceTimersByTimeAsync(400);

      expect(mockSdk.sendStateEvent).toHaveBeenCalledTimes(2);
      expect(mockSdk.sendStateEvent).toHaveBeenCalledWith(roomId, type, { x: 2, _v: 3 }, 't1');
      expect(mockSdk.sendStateEvent).toHaveBeenCalledWith(roomId, type, { x: 10, _v: 2 }, 't2');
    });
  });

  describe('Throttling: Streaming (Drawing)', () => {
    beforeEach(async () => {
      await client.start();
      const mockSdk = sdk.createClient();
      const syncCallback = mockSdk.on.mock.calls.find(call => call[0] === 'sync')[1];
      syncCallback('PREPARED');
    });

    it('streams drawing updates with a fixed delay', async () => {
      const mockSdk = sdk.createClient();
      const roomId = '!room:id';
      const type = EVENT_TYPES.DRAWING;

      client.sendVTTEvent(roomId, type, null, { p: [0, 0] });
      client.sendVTTEvent(roomId, type, null, { p: [1, 1] });
      client.sendVTTEvent(roomId, type, null, { p: [2, 2] });

      expect(mockSdk.sendEvent).not.toHaveBeenCalled();

      // Advance by 1st delay
      await vi.advanceTimersByTimeAsync(100);
      expect(mockSdk.sendEvent).toHaveBeenCalledTimes(1);
      expect(mockSdk.sendEvent).toHaveBeenCalledWith(roomId, type, { p: [0, 0] });

      // Advance by 2nd delay
      await vi.advanceTimersByTimeAsync(100);
      expect(mockSdk.sendEvent).toHaveBeenCalledTimes(2);
      expect(mockSdk.sendEvent).toHaveBeenCalledWith(roomId, type, { p: [1, 1] });

      // Advance by 3rd delay
      await vi.advanceTimersByTimeAsync(100);
      expect(mockSdk.sendEvent).toHaveBeenCalledTimes(3);
      expect(mockSdk.sendEvent).toHaveBeenCalledWith(roomId, type, { p: [2, 2] });
    });

    it('enforces backpressure by dropping oldest drawing frames', async () => {
      const mockSdk = sdk.createClient();
      const roomId = '!room:id';
      const type = EVENT_TYPES.DRAWING;

      // Fill queue beyond maxQueue (50)
      for (let i = 0; i < 60; i++) {
        client.sendVTTEvent(roomId, type, null, { i });
      }

      // First tick should send the oldest *remaining* frame
      // Since maxQueue is 50, frames 0-9 should have been dropped.
      // So it should start with frame 10.
      await vi.advanceTimersByTimeAsync(100);
      expect(mockSdk.sendEvent).toHaveBeenCalledWith(roomId, type, { i: 10 });
    });
  });

  describe('sendVTTEvent - non-throttled types and connection guard', () => {
    it('refuses to send when not connected', async () => {
      // Fresh client; never started.
      await expect(client.sendVTTEvent('!r:id', EVENT_TYPES.SETTINGS, '', { a: 1 }))
        .rejects.toThrow(/Cannot send event in status: disconnected/);
    });

    it('sends untracked types immediately (no throttle)', async () => {
      await client.start();
      const mockSdk = sdk.createClient();
      const syncCallback = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
      syncCallback('PREPARED');

      await client.sendVTTEvent('!r:id', EVENT_TYPES.SETTINGS, '', { a: 1 });
      expect(mockSdk.sendStateEvent).toHaveBeenCalledWith('!r:id', EVENT_TYPES.SETTINGS, { a: 1 }, '');
    });

    it('routes 401 from the SDK into _handleAuthError (status passes through AUTH_ERROR)', async () => {
      await client.start();
      const mockSdk = sdk.createClient();
      const syncCallback = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
      syncCallback('PREPARED');

      const seen = [];
      client.onStatusUpdate((s) => seen.push(s));

      const err = Object.assign(new Error('unauthorised'), { httpStatus: 401 });
      mockSdk.sendStateEvent.mockRejectedValueOnce(err);

      await expect(client.sendVTTEvent('!r:id', EVENT_TYPES.SETTINGS, '', { a: 1 }))
        .rejects.toThrow();

      // _handleAuthError flips status to AUTH_ERROR and then stop() -> DISCONNECTED;
      // the listener observes both transitions.
      expect(seen).toContain(CLIENT_STATUS.AUTH_ERROR);
    });
  });

  describe('SDK-backed room/user methods', () => {
    it('getJoinedRooms unwraps {joined_rooms}', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getJoinedRooms.mockResolvedValueOnce({ joined_rooms: ['!a:m', '!b:m'] });
      expect(await client.getJoinedRooms()).toEqual(['!a:m', '!b:m']);
    });

    it('getJoinedRooms returns [] when SDK omits the field', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getJoinedRooms.mockResolvedValueOnce({});
      expect(await client.getJoinedRooms()).toEqual([]);
    });

    it('joinRoom returns roomId from the Room object', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.joinRoom.mockResolvedValueOnce({ roomId: '!joined:m' });
      expect(await client.joinRoom('#alias:m')).toBe('!joined:m');
      expect(mockSdk.joinRoom).toHaveBeenCalledWith('#alias:m', undefined);
    });

    it('joinRoom merges caller-provided via servers with the derived origin', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.joinRoom.mockResolvedValueOnce({ roomId: '!room:origin.org' });
      await client.joinRoom('!room:origin.org', ['one.org', 'origin.org']);
      expect(mockSdk.joinRoom).toHaveBeenCalledWith('!room:origin.org', {
        viaServers: ['one.org', 'origin.org'],
      });
    });

    it('joinRoom passes caller via servers for aliases', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.joinRoom.mockResolvedValueOnce({ roomId: '!joined:m' });
      await client.joinRoom('#alias:m', ['one.org']);
      expect(mockSdk.joinRoom).toHaveBeenCalledWith('#alias:m', { viaServers: ['one.org'] });
    });

    it('leaveRoom calls sdk.leave then sdk.forget; forget failures are swallowed', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.forget.mockRejectedValueOnce(new Error('not joined anymore'));
      await expect(client.leaveRoom('!r:m')).resolves.toBeUndefined();
      expect(mockSdk.leave).toHaveBeenCalledWith('!r:m');
      expect(mockSdk.forget).toHaveBeenCalledWith('!r:m');
    });

    it('getRoomName falls back to roomId on SDK error', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getStateEvent.mockRejectedValueOnce(new Error('forbidden'));
      expect(await client.getRoomName('!r:m')).toBe('!r:m');
    });

    it('getVttState returns null on SDK error', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getStateEvent.mockRejectedValueOnce(new Error('not found'));
      expect(await client.getVttState('!r:m')).toBeNull();
    });

    it('createRoom passes name + private preset and returns room_id', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.createRoom.mockResolvedValueOnce({ room_id: '!fresh:m' });
      expect(await client.createRoom('Campaign A')).toBe('!fresh:m');
      expect(mockSdk.createRoom).toHaveBeenCalledWith({ name: 'Campaign A', preset: 'private_chat' });
    });

    it('resolveRoomAlias returns room_id from the SDK response', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getRoomIdForAlias.mockResolvedValueOnce({ room_id: '!resolved:m', servers: ['m'] });
      expect(await client.resolveRoomAlias('#alias:m')).toBe('!resolved:m');
    });

    it('getRoomMembers adapts {joined: {...}} to [{userId, displayname}]', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.getJoinedRoomMembers.mockResolvedValueOnce({
        joined: {
          '@a:m': { display_name: 'Alice' },
          '@b:m': {},
        },
      });
      expect(await client.getRoomMembers('!r:m')).toEqual([
        { userId: '@a:m', displayname: 'Alice' },
        { userId: '@b:m', displayname: '@b:m' },
      ]);
    });

    it('upgradeRoom returns the replacement room id', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.upgradeRoom.mockResolvedValueOnce({ replacement_room: '!v11:m' });
      expect(await client.upgradeRoom('!old:m')).toBe('!v11:m');
      expect(mockSdk.upgradeRoom).toHaveBeenCalledWith('!old:m', '11');
    });

    it('knockRoom forwards reason wrapped in opts', async () => {
      const mockSdk = sdk.createClient();
      mockSdk.knockRoom.mockResolvedValueOnce({ room_id: '!r:m' });
      expect(await client.knockRoom('!r:m', 'pls let me in')).toBe('!r:m');
      expect(mockSdk.knockRoom).toHaveBeenCalledWith('!r:m', { reason: 'pls let me in', viaServers: ['m'] });
    });
  });

  describe('onStatusUpdate', () => {
    it('invokes the listener immediately with the current status', () => {
      const cb = vi.fn();
      client.onStatusUpdate(cb);
      expect(cb).toHaveBeenCalledWith(CLIENT_STATUS.DISCONNECTED);
    });

    it('returns an unsubscribe handle that removes the listener', async () => {
      const cb = vi.fn();
      const off = client.onStatusUpdate(cb);
      cb.mockClear();
      off();

      // Trigger a status change - listener must not be called again.
      const startPromise = client.start();
      const mockSdk = sdk.createClient();
      const syncCallback = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
      syncCallback('PREPARED');
      await startPromise;

      expect(cb).not.toHaveBeenCalled();
    });

    it('does not refire when _setStatus is called with the same value', () => {
      const cb = vi.fn();
      client.onStatusUpdate(cb);
      cb.mockClear();
      client._setStatus(CLIENT_STATUS.DISCONNECTED);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

describe('MatrixClient - rate-limit retry on sends', () => {
  const credentials = {
    homeserver: 'https://matrix.org',
    accessToken: 's3cret',
    userId: '@alice:matrix.org',
  };

  beforeEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  function rateLimit(retryAfterMs) {
    return Object.assign(new Error('Too Many Requests'), {
      httpStatus: 429,
      errcode: 'M_LIMIT_EXCEEDED',
      data: { retry_after_ms: retryAfterMs },
    });
  }

  it('retries a 429 room-event send (yjs.update path) and then succeeds', async () => {
    const client = new MatrixClient(credentials);
    client.status = CLIENT_STATUS.CONNECTED;
    // The sdk mock is a module singleton; reset queued once-impls so
    // leftovers from a prior test can't satisfy this call.
    client.sdk.sendEvent.mockReset();
    client.sdk.sendEvent
      .mockRejectedValueOnce(rateLimit(1))
      .mockResolvedValueOnce({ event_id: '$ok' });

    const res = await client.sendVTTEvent('!r:m', 'com.matrixvtt.yjs.update', null, { d: 'x' });

    expect(client.sdk.sendEvent).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ event_id: '$ok' });
  });

  it('does not retry a non-429 error (auth/permission bubble up immediately)', async () => {
    const client = new MatrixClient(credentials);
    client.status = CLIENT_STATUS.CONNECTED;
    client.sdk.sendEvent.mockReset();
    const forbidden = Object.assign(new Error('forbidden'), { httpStatus: 403, errcode: 'M_FORBIDDEN' });
    client.sdk.sendEvent.mockRejectedValueOnce(forbidden);

    await expect(client.sendVTTEvent('!r:m', 'com.matrixvtt.yjs.update', null, { d: 'x' }))
      .rejects.toThrow(/forbidden/);
    expect(client.sdk.sendEvent).toHaveBeenCalledTimes(1);
  });
});
