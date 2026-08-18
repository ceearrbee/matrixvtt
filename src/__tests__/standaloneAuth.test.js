/**
 * startSSOLogin coverage for src/standalone/auth.js: callback URL
 * construction (escaping + sessionStorage stash) and the
 * missing-homeserver reject. The SSO completion path is covered in
 * ssoLoginCallback.test.jsx; form login and sign-out live in
 * AuthScreen.jsx / StandaloneShell.jsx and are tested through those.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startSSOLogin } from '../standalone/auth.js';

function makeField(value = '') {
  return { value, disabled: false, style: {}, textContent: '' };
}

function makeApp(overrides = {}) {
  const fields = {
    'hs-url': makeField('matrix.example.org'),
  };
  const MatrixClient = vi.fn();
  MatrixClient.getSSORedirectURL = vi.fn((hs, cb) => `${hs}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(cb)}`);

  return {
    doc: { getElementById: (id) => fields[id] || null },
    location: { origin: 'https://app.example.org', pathname: '/vtt/', href: '' },
    MatrixClient,
    resolvedHs: null,
    setLoginError: vi.fn(),
    _fields: fields,
    ...overrides,
  };
}

describe('startSSOLogin', () => {
  beforeEach(() => sessionStorage.clear());

  it('stashes the homeserver and constructs an escaped callback URL', () => {
    const app = makeApp();
    app.resolvedHs = 'https://matrix.example.org';
    startSSOLogin(app);
    expect(sessionStorage.getItem('mxvtt:sso-in-flight-hs')).toBe('https://matrix.example.org');
    expect(app.MatrixClient.getSSORedirectURL).toHaveBeenCalledWith(
      'https://matrix.example.org',
      'https://app.example.org/vtt/?hs=https%3A%2F%2Fmatrix.example.org',
    );
    expect(app.location.href).toContain('redirectUrl=');
  });

  it('errors when no homeserver is available', () => {
    const app = makeApp();
    app._fields['hs-url'].value = '';
    app.resolvedHs = null;
    startSSOLogin(app);
    expect(app.setLoginError).toHaveBeenCalledWith(expect.stringMatching(/required/i));
    expect(app.MatrixClient.getSSORedirectURL).not.toHaveBeenCalled();
  });
});
