/**
 * SSO callback contract (mozilla.org-class SSO-only homeservers):
 *  - finishSSOLogin routes success through app.completeLogin (the shell's
 *    onLogin), which owns saving the session and switching screens.
 *  - finishSSOLogin routes failure through app.setLoginError, which the
 *    shell renders inside AuthScreen.
 *  - StandaloneShell wires both hooks onto the app at mount.
 * Anything else leaves the user on the login screen after the IdP
 * redirect, because the discovery DOM only exists once the shell
 * switches screens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { finishSSOLogin } from '../standalone/auth.js';
import { StandaloneShell } from '../standalone/StandaloneShell.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';

function makeApp(overrides = {}) {
  const MatrixClient = /** @type {any} */ (vi.fn(function (opts) {
    Object.assign(this, opts);
    this.getProfile = vi.fn().mockResolvedValue({ displayname: 'Mox' });
  }));
  MatrixClient.loginWithSSOToken = vi
    .fn()
    .mockResolvedValue({ access_token: 'sso-tok', user_id: '@mox:mozilla.org' });

  return {
    MatrixClient,
    auth: null,
    completeLogin: vi.fn(),
    setLoginError: vi.fn(),
    showScreen: vi.fn(),
    loadDiscovery: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
  await Promise.resolve();
}

describe('finishSSOLogin', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('routes success through app.completeLogin, not a direct loadDiscovery call', async () => {
    const app = makeApp();
    await finishSSOLogin(app, 'https://mozilla.modular.im', 'tok123');

    expect(app.MatrixClient.loginWithSSOToken).toHaveBeenCalledWith(
      'https://mozilla.modular.im',
      'tok123',
    );
    expect(app.completeLogin).toHaveBeenCalledOnce();
    expect(app.completeLogin.mock.calls[0][0]).toMatchObject({
      homeserver: 'https://mozilla.modular.im',
      accessToken: 'sso-tok',
      userId: '@mox:mozilla.org',
      displayName: 'Mox',
    });
    expect(app.loadDiscovery).not.toHaveBeenCalled();
  });

  it('routes failure through app.setLoginError and returns to the login screen', async () => {
    const app = makeApp();
    app.MatrixClient.loginWithSSOToken = vi
      .fn()
      .mockRejectedValue(new Error('M_FORBIDDEN: token expired'));

    await finishSSOLogin(app, 'https://mozilla.modular.im', 'stale');

    expect(app.completeLogin).not.toHaveBeenCalled();
    expect(app.showScreen).toHaveBeenCalledWith('login');
    expect(app.setLoginError).toHaveBeenCalledOnce();
    expect(app.setLoginError.mock.calls[0][0]).toMatch(/sso sign-in failed/i);
  });

  it('clears the in-flight homeserver stash on both outcomes', async () => {
    sessionStorage.setItem('mxvtt:sso-in-flight-hs', 'https://mozilla.modular.im');
    const app = makeApp();
    await finishSSOLogin(app, 'https://mozilla.modular.im', 'tok123');
    expect(sessionStorage.getItem('mxvtt:sso-in-flight-hs')).toBeNull();
  });
});

describe('StandaloneShell login hooks', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  function mountShell(appOverrides = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const app = /** @type {any} */ ({
      auth: null,
      appLog: { add: () => {} },
      loadDiscovery: vi.fn().mockResolvedValue(undefined),
      enterRoom: vi.fn(),
      MatrixClient: function () {},
      ...appOverrides,
    });
    render(h(StandaloneShell, { app }), root);
    return { root, app };
  }

  it('exposes app.completeLogin; calling it saves the session and shows discovery', async () => {
    const { root, app } = mountShell();
    await flush();
    expect(root.querySelector('#login-form')).toBeTruthy();
    expect(typeof app.completeLogin).toBe('function');

    app.completeLogin({
      homeserver: 'https://mozilla.modular.im',
      accessToken: 'sso-tok',
      userId: '@mox:mozilla.org',
      displayName: 'Mox',
      client: {},
    });
    await flush();

    expect(root.querySelector('#login-form')).toBeFalsy();
    expect(root.querySelector('.discovery-card')).toBeTruthy();
    expect(app.auth).toMatchObject({ userId: '@mox:mozilla.org' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION));
    expect(stored).toMatchObject({ accessToken: 'sso-tok', userId: '@mox:mozilla.org' });
  });

  it('exposes app.setLoginError; the message renders inside the login screen', async () => {
    const { root, app } = mountShell();
    await flush();
    expect(typeof app.setLoginError).toBe('function');

    app.setLoginError('SSO sign-in failed: token expired');
    await flush();

    const errorEl = root.querySelector('#login-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('SSO sign-in failed');
  });
});
