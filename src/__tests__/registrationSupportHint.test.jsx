/**
 * The homeserver field says whether the server can create an account
 * here. The default value (matrix.org) needs a CAPTCHA this app cannot
 * run, so the "Create account" button below it could never work - and
 * the user only found out after clicking it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { AuthScreen } from '../standalone/AuthScreen.jsx';

function makeApp({ registerUia }) {
  class FakeClient {
    static discoverHomeserver = vi.fn(async (hs) => hs);
    static getLoginFlows = vi.fn(async () => [{ type: 'm.login.password' }]);
    static register = vi.fn(async () => ({ done: false, uia: registerUia }));
  }
  return /** @type {any} */ ({ MatrixClient: FakeClient, setLoginError: vi.fn() });
}

const CAPTCHA_ONLY = { flows: [{ stages: ['m.login.recaptcha', 'm.login.dummy'] }], session: 's' };
const OPEN = { flows: [{ stages: ['m.login.dummy'] }], session: 's' };

describe('registration support hint', () => {
  afterEach(cleanup);

  it('warns at the homeserver field when the server cannot register here', async () => {
    const { container } = render(h(AuthScreen, { app: makeApp({ registerUia: CAPTCHA_ONLY }), onLogin: () => {} }));
    await waitFor(() => {
      expect(container.querySelector('#register-unsupported-hint')).not.toBeNull();
    });
    const hint = container.querySelector('#register-unsupported-hint');
    expect(hint.textContent.toLowerCase()).toMatch(/cannot|can't/);
    expect(hint.querySelector('a[href*="element.io"]')).not.toBeNull();
  });

  it('stays quiet for a server that does support in-app registration', async () => {
    const { container } = render(h(AuthScreen, { app: makeApp({ registerUia: OPEN }), onLogin: () => {} }));
    await waitFor(() => {
      expect(container.querySelector('#hs-url')).not.toBeNull();
    });
    expect(container.querySelector('#register-unsupported-hint')).toBeNull();
  });

  it('describes the homeserver field as the place registration is decided', async () => {
    const { container } = render(h(AuthScreen, { app: makeApp({ registerUia: CAPTCHA_ONLY }), onLogin: () => {} }));
    await waitFor(() => {
      expect(container.querySelector('#register-unsupported-hint')).not.toBeNull();
    });
    expect(container.querySelector('#hs-url').getAttribute('aria-describedby'))
      .toMatch(/register-unsupported-hint/);
  });
});
