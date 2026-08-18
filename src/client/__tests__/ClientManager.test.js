/**
 * ClientManager unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeManagerWithMocks({ getPowerLevels, putStateEvent, throwInGetRoom = false } = {}) {
  const mockClient = {
    start: vi.fn().mockResolvedValue({}),
    stop: vi.fn().mockResolvedValue({}),
    sendVTTEvent: vi.fn().mockResolvedValue({}),
    sdk: {
      getCapabilities: vi.fn().mockResolvedValue({}),
      getRoom: vi.fn().mockImplementation(() => {
        if (throwInGetRoom) throw new Error('forbidden');
        return {
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: () => ({ users: {}, users_default: 0, events: {} })
            })
          }
        };
      })
    },
    putStateEvent: putStateEvent ?? vi.fn().mockResolvedValue({}),
    getPowerLevels: getPowerLevels ?? vi.fn().mockResolvedValue({ users: {}, users_default: 0, events: {} }),
    getRoomMembers: vi.fn().mockResolvedValue([]),
    setRoomDisplayName: vi.fn().mockResolvedValue(undefined),
    uploadMedia: vi.fn().mockResolvedValue('mxc://x'),
    getCapabilities: vi.fn().mockResolvedValue({}),
  };

  vi.doMock('../MatrixClient.js', () => ({
    MatrixClient: class {
      constructor() { Object.assign(this, mockClient); this._rateLimitedUntil = 0; }
    }
  }));
  vi.doMock('../MatrixApiAdapter.js', () => ({
    MatrixApiAdapter: class { stopSync() {} }
  }));

  return { mockClient };
}

describe('ClientManager.setRoomPowerLevels', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('propagates failures so ensurePlayerPowerLevels can retry and surface them', async () => {
    makeManagerWithMocks({
      throwInGetRoom: true
    });

    const { ClientManager } = await import('../ClientManager.js');
    const manager = new ClientManager();
    manager.setCredentials('https://matrix.example.com', 'tok', '@gm:example.com', '!room:example.com');
    await manager.init();

    await expect(manager.setRoomPowerLevels(['@gm:example.com'])).rejects.toThrow();
  });
});

describe('ClientManager.canEditRoomState', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function withRoomMember(powerLevel) {
    const sdkRoom = powerLevel == null ? null : {
      getMember: vi.fn().mockReturnValue({ powerLevel }),
      currentState: { getStateEvents: vi.fn() },
    };
    const mockClient = {
      start: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue({}),
      sendVTTEvent: vi.fn().mockResolvedValue({}),
      sdk: {
        getCapabilities: vi.fn().mockResolvedValue({}),
        getRoom: vi.fn().mockReturnValue(sdkRoom),
      },
    };
    vi.doMock('../MatrixClient.js', () => ({
      MatrixClient: class { constructor() { Object.assign(this, mockClient); } }
    }));
    vi.doMock('../MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { stopSync() {} }
    }));
    return { mockClient };
  }

  it('returns true when user power level is >= 50', async () => {
    withRoomMember(50);
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    expect(await m.canEditRoomState()).toBe(true);
  });

  it('returns false for default-power members (< 50)', async () => {
    withRoomMember(0);
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    expect(await m.canEditRoomState()).toBe(false);
  });

  it('returns false fail-closed when the room is not in the SDK cache', async () => {
    withRoomMember(null);
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    expect(await m.canEditRoomState()).toBe(false);
  });

  it('caches the result for 30s - second call does not re-read from the SDK', async () => {
    const { mockClient } = withRoomMember(80);
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    await m.canEditRoomState();
    const before = mockClient.sdk.getRoom.mock.calls.length;
    await m.canEditRoomState();
    expect(mockClient.sdk.getRoom.mock.calls.length).toBe(before);
  });
});

describe('ClientManager.init', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('is idempotent - second call does not start the client twice or leak the adapter', async () => {
    const start = vi.fn().mockResolvedValue({});
    vi.doMock('../MatrixClient.js', () => ({
      MatrixClient: class { start = start; stop = vi.fn(); sdk = { getCapabilities: vi.fn().mockResolvedValue({}), getRoom: () => null }; }
    }));
    let adapterCount = 0;
    vi.doMock('../MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { constructor() { adapterCount++; } stopSync() {} }
    }));
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    await m.init();
    expect(start).toHaveBeenCalledTimes(1);
    expect(adapterCount).toBe(1);
  });

  it('refuses to initialise without setCredentials', async () => {
    vi.doMock('../MatrixClient.js', () => ({
      MatrixClient: class { start = vi.fn(); stop = vi.fn(); sdk = { getCapabilities: vi.fn().mockResolvedValue({}) }; }
    }));
    vi.doMock('../MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { stopSync() {} }
    }));
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    await expect(m.init()).rejects.toThrow(/setCredentials\(\) must be called/);
  });
});

describe('ClientManager.destroy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('stops the api adapter, the client, and clears widgetApi', async () => {
    const adapterStop = vi.fn();
    const clientStop = vi.fn().mockResolvedValue({});
    vi.doMock('../MatrixClient.js', () => ({
      MatrixClient: class {
        start = vi.fn().mockResolvedValue({});
        stop = clientStop;
        sdk = { getCapabilities: vi.fn().mockResolvedValue({}), getRoom: () => null };
      }
    }));
    vi.doMock('../MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { stopSync = adapterStop; }
    }));
    const { ClientManager } = await import('../ClientManager.js');
    const m = new ClientManager();
    m.setCredentials('h', 't', '@u:m', '!r:m');
    await m.init();
    m.destroy();
    expect(adapterStop).toHaveBeenCalled();
    expect(clientStop).toHaveBeenCalled();
    expect(m.widgetApi).toBeNull();
  });
});
