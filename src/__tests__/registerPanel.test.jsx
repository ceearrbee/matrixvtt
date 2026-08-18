/**
 * RegisterPanel - in-app account creation over UIA.
 *
 * Supports the script-free stages (dummy, terms, registration token,
 * email); recaptcha-gated servers (matrix.org) keep the element.io
 * exit. The email stage parks in a wait state with resend until the
 * server confirms the click-through.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { RegisterPanel } from '../standalone/RegisterPanel.jsx';

afterEach(() => cleanup());

const TOKEN_TERMS_UIA = {
  session: 'sess1',
  flows: [{ stages: ['m.login.registration_token', 'm.login.terms'] }],
  params: {
    'm.login.terms': {
      policies: {
        privacy: { version: '1', en: { name: 'Privacy Policy', url: 'https://hs.test/privacy' } },
      },
    },
  },
};

function makeApp({ register = null, requestRegisterEmailToken = null } = {}) {
  function FakeClient() {
    this.getProfile = async () => ({ displayname: 'New Person' });
  }
  return /** @type {any} */ ({
    resolvedHs: 'https://hs.test',
    MatrixClient: Object.assign(FakeClient, {
      discoverHomeserver: vi.fn().mockResolvedValue('https://hs.test'),
      register: register ?? vi.fn().mockResolvedValue({ done: false, uia: TOKEN_TERMS_UIA }),
      requestRegisterEmailToken: requestRegisterEmailToken ?? vi.fn().mockResolvedValue({ sid: 'sid1' }),
    }),
  });
}

function fill(container, id, value) {
  const el = container.querySelector(`#${id}`);
  el.value = value;
  fireEvent.input(el);
}

describe('RegisterPanel', () => {
  it('offers the element.io exit when every flow needs recaptcha', async () => {
    const register = vi.fn().mockResolvedValue({
      done: false,
      uia: { session: 's', flows: [{ stages: ['m.login.recaptcha', 'm.login.dummy'] }], params: {} },
    });
    const { container, getByText } = render(
      h(RegisterPanel, { app: makeApp({ register }), onLogin: vi.fn(), onBack: vi.fn() }));
    await waitFor(() => {
      expect(getByText(/element\.io/i)).toBeTruthy();
    });
    expect(container.querySelector('#register-username')).toBeNull();
  });

  it('shows the register-context copy when registration is disabled', async () => {
    const register = vi.fn().mockRejectedValue(
      Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN', httpStatus: 403 }));
    const { getByText } = render(
      h(RegisterPanel, { app: makeApp({ register }), onLogin: vi.fn(), onBack: vi.fn() }));
    await waitFor(() => {
      expect(getByText(/does not allow open registration/i)).toBeTruthy();
    });
  });

  it('walks a token + terms flow to credentials and calls onLogin', async () => {
    const register = vi.fn()
      .mockResolvedValueOnce({ done: false, uia: TOKEN_TERMS_UIA })
      .mockResolvedValueOnce({ done: false, uia: { ...TOKEN_TERMS_UIA, completed: ['m.login.registration_token'] } })
      .mockResolvedValueOnce({ done: true, credentials: { user_id: '@new:hs.test', access_token: 'tok', device_id: 'D' } });
    const onLogin = vi.fn();
    const app = makeApp({ register });
    const { container, getByRole } = render(h(RegisterPanel, { app, onLogin, onBack: vi.fn() }));

    await waitFor(() => expect(container.querySelector('#register-username')).not.toBeNull());
    expect(container.textContent).toContain('Privacy Policy');

    fill(container, 'register-username', 'newbie');
    fill(container, 'register-password', 'hunter2hunter2');
    fill(container, 'register-token', 'LETMEIN');
    fireEvent.click(container.querySelector('#register-terms'));
    fireEvent.click(getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    const auth = onLogin.mock.calls[0][0];
    expect(auth.userId).toBe('@new:hs.test');
    expect(auth.accessToken).toBe('tok');

    const bodies = register.mock.calls.map((c) => c[1]);
    expect(bodies[1].auth).toEqual({ type: 'm.login.registration_token', session: 'sess1', token: 'LETMEIN' });
    expect(bodies[2].auth).toEqual({ type: 'm.login.terms', session: 'sess1' });
    expect(bodies[2].username).toBe('newbie');
  });

  it('rejected registration token keeps the form with a clear error', async () => {
    const register = vi.fn()
      .mockResolvedValueOnce({ done: false, uia: TOKEN_TERMS_UIA })
      .mockResolvedValueOnce({ done: false, uia: { ...TOKEN_TERMS_UIA, completed: [] } });
    const { container, getByRole, getByText } = render(
      h(RegisterPanel, { app: makeApp({ register }), onLogin: vi.fn(), onBack: vi.fn() }));

    await waitFor(() => expect(container.querySelector('#register-username')).not.toBeNull());
    fill(container, 'register-username', 'newbie');
    fill(container, 'register-password', 'hunter2hunter2');
    fill(container, 'register-token', 'WRONG');
    fireEvent.click(container.querySelector('#register-terms'));
    fireEvent.click(getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(getByText(/token was not accepted/i)).toBeTruthy());
  });

  it('email stage parks in a wait state with resend, then completes', async () => {
    const EMAIL_UIA = { session: 'e1', flows: [{ stages: ['m.login.email.identity'] }], params: {} };
    const register = vi.fn()
      .mockResolvedValueOnce({ done: false, uia: EMAIL_UIA })
      .mockResolvedValueOnce({ done: false, uia: { ...EMAIL_UIA, completed: [] } })
      .mockResolvedValueOnce({ done: true, credentials: { user_id: '@new:hs.test', access_token: 'tok' } });
    const requestRegisterEmailToken = vi.fn().mockResolvedValue({ sid: 'sid1' });
    const onLogin = vi.fn();
    const app = makeApp({ register, requestRegisterEmailToken });
    const { container, getByRole, getByText } = render(h(RegisterPanel, { app, onLogin, onBack: vi.fn() }));

    await waitFor(() => expect(container.querySelector('#register-username')).not.toBeNull());
    fill(container, 'register-username', 'newbie');
    fill(container, 'register-password', 'hunter2hunter2');
    fill(container, 'register-email', 'new@example.com');
    fireEvent.click(getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(getByText(/check your email/i)).toBeTruthy());
    expect(requestRegisterEmailToken).toHaveBeenCalledTimes(1);
    expect(requestRegisterEmailToken.mock.calls[0][1]).toBe('new@example.com');

    fireEvent.click(getByRole('button', { name: /resend/i }));
    await waitFor(() => expect(requestRegisterEmailToken).toHaveBeenCalledTimes(2));
    expect(requestRegisterEmailToken.mock.calls[1][3])
      .toBeGreaterThan(requestRegisterEmailToken.mock.calls[0][3]);

    fireEvent.click(getByRole('button', { name: /verified/i }));
    await waitFor(() => expect(getByText(/not verified yet/i)).toBeTruthy());

    fireEvent.click(getByRole('button', { name: /verified/i }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    const emailAuth = register.mock.calls.at(-1)[1].auth;
    expect(emailAuth.type).toBe('m.login.email.identity');
    expect(emailAuth.threepid_creds.sid).toBe('sid1');
  });
});
