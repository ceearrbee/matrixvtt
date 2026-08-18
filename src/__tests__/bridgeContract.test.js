import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('shared bridge contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('WidgetManager standalone fallback exposes the shared bridge surface', async () => {
    vi.doMock('@matrix-widget-toolkit/api', () => ({
      WidgetApiImpl: { create: vi.fn() }
    }));

    const { WidgetManager } = await import('../widget/WidgetManager.js');
    const manager = new WidgetManager();
    manager.initStandalone();

    expect(manager.isAppClient).toBe(false);
    expect(manager.userIdResolved).toBe(true);
    expect(typeof manager.getApi).toBe('function');
    expect(typeof manager.sendStateEvent).toBe('function');
    expect(typeof manager.sendRoomEvent).toBe('function');
    expect(typeof manager.canEditRoomState).toBe('function');
    expect(typeof manager.getRoomMembers).toBe('function');
    expect(typeof manager.setDisplayName).toBe('function');
    expect(typeof manager.uploadMedia).toBe('function');
    expect(typeof manager.destroy).toBe('function');
    expect(manager.getApi()).toBe(manager.widgetApi);
  });

  it('ClientManager exposes the same shared bridge surface after init', async () => {
    const sendVTTEvent = vi.fn().mockResolvedValue({ event_id: '$state' });
    const getPowerLevels = vi.fn().mockResolvedValue({ users: { '@user:example.com': 50 }, users_default: 0 });
    
    vi.doMock('../client/MatrixClient.js', () => ({
      MatrixClient: class {
        constructor({ homeserver, accessToken, userId }) {
          this.homeserver = homeserver;
          this.accessToken = accessToken;
          this.userId = userId;
          this.sdk = {
            getCapabilities: vi.fn().mockResolvedValue({}),
            getRoom: vi.fn().mockReturnValue({
              currentState: {
                getStateEvents: vi.fn().mockReturnValue({
                  getContent: () => ({ users: { '@user:example.com': 50 }, users_default: 0 })
                })
              },
              getJoinedMembers: vi.fn().mockReturnValue([
                { userId: '@user:example.com', name: 'User' }
              ]),
              getMember: vi.fn().mockReturnValue({ powerLevel: 100 })
            }),
            setDisplayName: vi.fn().mockResolvedValue({}),
            uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://x' }),
          };
        }
        start() { return Promise.resolve(); }
        stop() { return Promise.resolve(); }
        sendVTTEvent(...args) { return sendVTTEvent(...args); }
        getPowerLevels(...args) { return getPowerLevels(...args); }
      }
    }));

    vi.doMock('../client/MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class {
        constructor(client, roomId) {
          this.client = client;
          this.roomId = roomId;
        }
        stopSync() {}
      }
    }));

    const { ClientManager } = await import('../client/ClientManager.js');
    const manager = new ClientManager();
    manager.setCredentials('https://matrix.example.com', 'secret', '@user:example.com', '!room:example.com');
    await manager.init();

    expect(manager.isAppClient).toBe(true);
    expect(manager.userIdResolved).toBe(true);
    expect(typeof manager.getApi).toBe('function');
    expect(typeof manager.sendStateEvent).toBe('function');
    expect(typeof manager.sendRoomEvent).toBe('function');
    expect(typeof manager.canEditRoomState).toBe('function');
    expect(typeof manager.getRoomMembers).toBe('function');
    expect(typeof manager.setDisplayName).toBe('function');
    expect(typeof manager.uploadMedia).toBe('function');
    expect(typeof manager.destroy).toBe('function');

    await manager.sendStateEvent('com.vtt.settings', '', { name: 'Campaign' });
    await manager.sendRoomEvent('m.room.message', { body: 'hi' });

    expect(sendVTTEvent).toHaveBeenCalledTimes(2);

    expect(await manager.canEditRoomState()).toBe(true);
    expect(await manager.getRoomMembers()).toEqual([
      { userId: '@user:example.com', displayname: 'User', inCall: false }
    ]);

    manager.destroy();
  });

  it('both managers expose the same public method surface', async () => {
    vi.doMock('@matrix-widget-toolkit/api', () => ({
      WidgetApiImpl: { create: vi.fn() }
    }));
    vi.doMock('../client/MatrixClient.js', () => ({ MatrixClient: class {} }));
    vi.doMock('../client/MatrixApiAdapter.js', () => ({ MatrixApiAdapter: class {} }));

    const { WidgetManager } = await import('../widget/WidgetManager.js');
    const { ClientManager } = await import('../client/ClientManager.js');

    const modeSpecific = new Set([
      'init', 'setCredentials',
      'extractWidgetContext', 'initStandalone', 'subscribeToTombstone',
    ]);
    const surface = (cls) => Object.getOwnPropertyNames(cls.prototype)
      .filter((n) => typeof Object.getOwnPropertyDescriptor(cls.prototype, n)?.value === 'function')
      .filter((n) => n !== 'constructor' && !n.startsWith('_') && !modeSpecific.has(n))
      .sort();

    expect(surface(ClientManager)).toEqual(surface(WidgetManager));
  });

  it('WidgetManager exposes roomIdsSupported as undefined by default', async () => {
    vi.doMock('@matrix-widget-toolkit/api', () => ({
      WidgetApiImpl: { create: vi.fn() }
    }));
    const { WidgetManager } = await import('../widget/WidgetManager.js');
    const manager = new WidgetManager();
    expect(manager.roomIdsSupported).toBeUndefined();
  });

  it('ClientManager.roomIdsSupported is always true', async () => {
    vi.doMock('../client/MatrixClient.js', () => ({
      MatrixClient: class {
        constructor() { 
          this.sdk = { getCapabilities: vi.fn().mockResolvedValue({}) };
        }
        start() { return Promise.resolve(); }
      }
    }));
    vi.doMock('../client/MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { stopSync() {} }
    }));
    const { ClientManager } = await import('../client/ClientManager.js');
    const manager = new ClientManager();
    manager.setCredentials('https://example.com', 'tok', '@u:example.com', '!r:example.com');
    await manager.init();
    expect(manager.roomIdsSupported).toBe(true);
  });

  it('WidgetManager.getEarliestRetryTime() returns 0', async () => {
    vi.doMock('@matrix-widget-toolkit/api', () => ({
      WidgetApiImpl: { create: vi.fn() }
    }));
    const { WidgetManager } = await import('../widget/WidgetManager.js');
    const manager = new WidgetManager();
    expect(manager.getEarliestRetryTime()).toBe(0);
  });

  it('ClientManager.getEarliestRetryTime() returns 0', async () => {
    vi.doMock('../client/MatrixClient.js', () => ({
      MatrixClient: class {
        constructor() { 
          this.sdk = { getCapabilities: vi.fn().mockResolvedValue({}) };
        }
        start() { return Promise.resolve(); }
      }
    }));
    vi.doMock('../client/MatrixApiAdapter.js', () => ({
      MatrixApiAdapter: class { stopSync() {} }
    }));
    const { ClientManager } = await import('../client/ClientManager.js');
    const manager = new ClientManager();
    manager.setCredentials('https://example.com', 'tok', '@u:example.com', '!r:example.com');
    await manager.init();
    expect(manager.getEarliestRetryTime()).toBe(0);
  });
});
