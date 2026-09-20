/**
 * Both transports must publish the homeserver, or every DOM <img>
 * holding an mxc portrait silently renders nothing in that mode.
 * `client/` and `widget/` expose the same public API; this is one more
 * place they have to agree.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClientManager } from '../client/ClientManager.js';
import { WidgetManager } from '../widget/WidgetManager.js';
import { homeserverSignal, accessTokenSignal } from '../state/ui-signals.js';

class FakeMatrixClient {
  constructor({ homeserver, accessToken }) {
    this.homeserver = homeserver;
    this.accessToken = accessToken;
  }
}

const REAL_FETCH = globalThis.fetch;

beforeEach(() => { homeserverSignal.value = null; accessTokenSignal.value = null; });
afterEach(() => { globalThis.fetch = REAL_FETCH; });

describe('standalone mode', () => {
  it('publishes the homeserver once credentials are set', () => {
    const cm = new ClientManager({ matrixClientClass: FakeMatrixClient });
    expect(homeserverSignal.value).toBeNull();
    cm.setCredentials('https://hs.example', 'tok', '@a:hs.example', '!r:hs.example');
    expect(homeserverSignal.value).toBe('https://hs.example');
  });

  // Authenticated media needs the token, not just the server.
  it('publishes the access token too', () => {
    const cm = new ClientManager({ matrixClientClass: FakeMatrixClient });
    cm.setCredentials('https://hs.example', 'syt_tok', '@a:hs.example', '!r:hs.example');
    expect(accessTokenSignal.value).toBe('syt_tok');
  });
});

describe('widget mode', () => {
  it('publishes the homeserver it learns from the OpenID credentials', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?widgetId=!room%3As_widget' },
      writable: true,
      configurable: true,
    });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ sub: '@a:example.org' }) }));

    const wm = new WidgetManager();
    wm.widgetApi = {
      widgetParameters: { userId: '@a:example.org' },
      requestOpenIDConnectToken: vi.fn().mockResolvedValue({
        access_token: 'tok',
        matrix_server_name: 'example.org',
      }),
    };

    await wm.extractWidgetContext();
    expect(wm.homeserver).toBe('https://example.org');
    expect(homeserverSignal.value).toBe('https://example.org');
  });

  // The widget only ever gets an OpenID token, which is not a client
  // access token and cannot fetch authenticated media. Publishing it
  // would send every media request out with a credential that 401s.
  it('publishes no access token, because it never has one', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?widgetId=!room%3As_widget' },
      writable: true,
      configurable: true,
    });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ sub: '@a:example.org' }) }));
    const wm = new WidgetManager();
    wm.widgetApi = {
      widgetParameters: { userId: '@a:example.org' },
      requestOpenIDConnectToken: vi.fn().mockResolvedValue({
        access_token: 'openid-not-a-client-token',
        matrix_server_name: 'example.org',
      }),
    };
    await wm.extractWidgetContext();
    expect(accessTokenSignal.value).toBeNull();
  });
});
