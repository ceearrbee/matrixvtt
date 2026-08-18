/**
 * Widget-mode transport contract.
 *
 * Element's OpenID credential (requestOpenIDConnectToken) is not a
 * client-server access token: the spec only lets it be exchanged at the
 * federation /openid/userinfo endpoint. Feeding it to matrix-js-sdk
 * makes every /sync 401, so the widget showed "Network error" and
 * "Lost connection to Matrix updates. The sync loop has stopped."
 *
 * Widget mode must therefore always read and write through the widget
 * API (createWidgetReadAdapter), keeping OpenID only for resolving the
 * user id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WidgetApiImpl } from '@matrix-widget-toolkit/api';
import { WidgetManager } from '../widget/WidgetManager.js';

vi.mock('@matrix-widget-toolkit/api', () => ({
  WidgetApiImpl: { create: vi.fn() },
}));

function makeWidgetApi() {
  return {
    widgetParameters: { userId: '@gm:mozilla.org', roomId: '!test3:mozilla.org' },
    requestCapabilities: vi.fn().mockResolvedValue(undefined),
    hasCapabilities: () => true,
    requestOpenIDConnectToken: vi.fn().mockResolvedValue({
      access_token: 'openid-token-not-a-cs-token',
      matrix_server_name: 'mozilla.org',
    }),
    receiveStateEvents: vi.fn().mockResolvedValue([]),
    observeStateEvents: vi.fn(() => ({ subscribe: vi.fn() })),
    observeRoomEvents: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
    receiveRoomEvents: vi.fn().mockResolvedValue([]),
  };
}

describe('WidgetManager widget-mode transport', () => {
  let originalTop;

  beforeEach(() => {
    originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    // init() treats self === top as standalone; pretend we are framed.
    Object.defineProperty(window, 'top', { value: {}, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalTop) Object.defineProperty(window, 'top', originalTop);
    vi.restoreAllMocks();
  });

  it('uses the widget read adapter even when OpenID credentials resolve', async () => {
    const widgetApi = makeWidgetApi();
    vi.mocked(WidgetApiImpl.create).mockResolvedValue(/** @type {any} */ (widgetApi));

    const wm = new WidgetManager();
    await wm.init();

    expect(wm._client).toBeUndefined();
    expect(wm.vttApi).toBeTruthy();
    expect(typeof wm.vttApi.getMessages).toBe('function');
    expect(wm.vttApi.isSyncHealthy()).toBe(true);
    expect(wm.roomId).toBe('!test3:mozilla.org');
    expect(wm.userId).toBe('@gm:mozilla.org');
  });

  it('never constructs a sync client from the OpenID token', async () => {
    const widgetApi = makeWidgetApi();
    vi.mocked(WidgetApiImpl.create).mockResolvedValue(/** @type {any} */ (widgetApi));

    const wm = new WidgetManager();
    await wm.init();

    // The OpenID token is only used transiently for /openid/userinfo;
    // nothing on the manager may keep it or treat it as a CS token.
    expect(wm._client).toBeUndefined();
    expect(wm.accessToken).toBeUndefined();
  });

  // Regression: room-adapter called wm._recordCall(), which only ever
  // existed on a hand-written test mock. On a real WidgetManager the
  // fetcher threw, the error path returned power level 0, and the room
  // creator sat at "Waiting for GM".
  it('resolves the real power level through a real WidgetManager instance', async () => {
    const widgetApi = makeWidgetApi();
    widgetApi.receiveStateEvents = vi.fn().mockResolvedValue([
      { content: { users: { '@gm:mozilla.org': 100 }, users_default: 0 } },
    ]);
    vi.mocked(WidgetApiImpl.create).mockResolvedValue(/** @type {any} */ (widgetApi));

    const wm = new WidgetManager();
    await wm.init();

    expect(await wm.getUserPowerLevel()).toBe(100);
    expect(await wm.canEditRoomState()).toBe(true);
  });

  it('attaches the widget Yjs transport when a manager is passed', async () => {
    const widgetApi = makeWidgetApi();
    vi.mocked(WidgetApiImpl.create).mockResolvedValue(/** @type {any} */ (widgetApi));

    const yjs = /** @type {any} */ ({
      onUpdate: vi.fn(),
      getStateVector: vi.fn(() => new Uint8Array([1])),
      handleMatrixUpdate: vi.fn(),
      compareStateVector: vi.fn(),
    });
    const wm = new WidgetManager();
    await wm.init(yjs);

    expect(wm._yjsTransport).toBeTruthy();
    expect(widgetApi.observeRoomEvents).toHaveBeenCalledWith('com.matrixvtt.yjs.update');
    expect(widgetApi.observeRoomEvents).toHaveBeenCalledWith('com.matrixvtt.yjs.sync_vector');
    wm.destroy();
  });
});
