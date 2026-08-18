/**
 * WidgetManager.extractWidgetContext - userId resolution.
 *
 * Priority order:
 *   1. widgetApi.widgetParameters.userId (toolkit-parsed URL template)
 *   2. URLSearchParams ?userId=@a:b (raw fallback)
 *   3. OpenID federation userinfo (only when neither above provided)
 *
 * Lock in the federation round-trip skip when the toolkit (or raw URL)
 * already gave us a valid MXID - the extra hop is a wasteful network
 * round-trip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WidgetManager } from '../widget/WidgetManager.js';

const REAL_FETCH = globalThis.fetch;

function makeManager({ widgetParameters = {}, search = '?widgetId=!room%3As_widget' } = {}) {
  // Stub window.location.search via a one-off setter - happy-dom keeps
  // the property writable so we don't need full URL replacement.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });

  const widgetApi = {
    widgetParameters,
    requestOpenIDConnectToken: vi.fn().mockResolvedValue({
      access_token: 'tok',
      matrix_server_name: 'example.org',
    }),
  };

  const wm = new WidgetManager();
  wm.widgetApi = widgetApi;
  return { wm, widgetApi };
}

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ sub: '@from-userinfo:example.org' }),
  }));
});

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  vi.restoreAllMocks();
});

describe('WidgetManager.extractWidgetContext userId resolution', () => {
  it('uses widgetParameters.userId when populated and skips the federation userinfo call', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '?widgetId=!room%3As_widget',
    });

    await wm.extractWidgetContext();

    expect(wm.userId).toBe('@alice:example.org');
    expect(wm.userIdResolved).toBe(true);
    // The federation /openid/userinfo hop is the one we want to avoid.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the ?userId URL param when the toolkit did not parse one', async () => {
    const { wm } = makeManager({
      widgetParameters: {},
      search: '?widgetId=!room%3As_widget&userId=%40bob%3Aexample.org',
    });

    await wm.extractWidgetContext();

    expect(wm.userId).toBe('@bob:example.org');
    expect(wm.userIdResolved).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('falls through to the OpenID userinfo round-trip when no MXID is in the URL', async () => {
    const { wm } = makeManager({
      widgetParameters: {},
      search: '?widgetId=!room%3As_widget',
    });

    await wm.extractWidgetContext();

    expect(wm.userId).toBe('@from-userinfo:example.org');
    expect(wm.userIdResolved).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/_matrix\/federation\/v1\/openid\/userinfo/);
  });

  it('ignores a malformed widgetParameters.userId and falls back', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: 'not-an-mxid' },
      search: '?widgetId=!room%3As_widget&userId=%40carol%3Aexample.org',
    });

    await wm.extractWidgetContext();

    expect(wm.userId).toBe('@carol:example.org');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('WidgetManager.extractWidgetContext roomId resolution', () => {
  it('prefers the toolkit widgetParameters.roomId', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: '@alice:example.org', roomId: '!real:example.org' },
      search: '?widgetId=!stale%3As_widget',
    });
    await wm.extractWidgetContext();
    expect(wm.roomId).toBe('!real:example.org');
  });

  it('ignores the unreplaced $matrix_room_id placeholder', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: '@alice:example.org', roomId: '$matrix_room_id' },
      search: '?roomId=!fromurl%3Aexample.org',
    });
    await wm.extractWidgetContext();
    expect(wm.roomId).toBe('!fromurl:example.org');
  });

  it('reads a raw roomId URL param when the toolkit has none', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '?userId=%40alice%3Aexample.org&roomId=!fromurl%3Aexample.org',
    });
    await wm.extractWidgetContext();
    expect(wm.roomId).toBe('!fromurl:example.org');
  });

  it('falls back to the widgetId prefix, then unknown-room', async () => {
    const { wm } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '?widgetId=!legacy%3As_widget',
    });
    await wm.extractWidgetContext();
    expect(wm.roomId).toBe('!legacy:s');

    const { wm: bare } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '',
    });
    await bare.extractWidgetContext();
    expect(bare.roomId).toBe('unknown-room');
  });
});

describe('WidgetManager.extractWidgetContext toolkit roomId backfill', () => {
  // The toolkit's observeStateEvents throws "Current room id is unknown"
  // whenever its own widgetParameters.roomId is empty, and it only parses
  // a matrix_room_id URL param. Whatever source we resolved the room id
  // from must be written back so live subscriptions work.
  it('backfills widgetParameters.roomId from a raw roomId URL param', async () => {
    const { wm, widgetApi } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '?roomId=!fromurl%3Aexample.org',
    });
    await wm.extractWidgetContext();
    expect(widgetApi.widgetParameters.roomId).toBe('!fromurl:example.org');
  });

  it('replaces an unsubstituted $matrix_room_id placeholder', async () => {
    const { wm, widgetApi } = makeManager({
      widgetParameters: { userId: '@alice:example.org', roomId: '$matrix_room_id' },
      search: '?roomId=!fromurl%3Aexample.org',
    });
    await wm.extractWidgetContext();
    expect(widgetApi.widgetParameters.roomId).toBe('!fromurl:example.org');
  });

  it('leaves widgetParameters untouched when no room id resolved', async () => {
    const { wm, widgetApi } = makeManager({
      widgetParameters: { userId: '@alice:example.org' },
      search: '',
    });
    await wm.extractWidgetContext();
    expect(widgetApi.widgetParameters.roomId).toBeUndefined();
  });
});
