/**
 * AuthScreen login-flow discovery and rate-limit handling.
 *
 * The homeserver field is prefilled with https://matrix.org and most
 * users never edit it, so the flow probe must run on mount or the SSO
 * button never appears for the default server. Probe failures must
 * degrade softly (never hide a previously discovered SSO path, never
 * lock the password form), and a 429 on login must honor
 * retry_after_ms with a visible countdown instead of inviting an
 * instant retry loop.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { AuthScreen } from '../standalone/AuthScreen.jsx';

const SSO_AND_PASSWORD = [{ type: 'm.login.sso' }, { type: 'm.login.password' }];

function makeApp(overrides = {}) {
  return /** @type {any} */ ({
    resolvedHs: null,
    setLoginError: vi.fn(),
    getAuthErrorMessage: (err) => err?.friendly || err?.message || 'failed',
    startSSOLogin: vi.fn(),
    MatrixClient: Object.assign(function () {}, {
      discoverHomeserver: vi.fn().mockResolvedValue('https://matrix.org'),
      getLoginFlows: vi.fn().mockResolvedValue(SSO_AND_PASSWORD),
      login: vi.fn(),
      loginWithToken: vi.fn(),
    }),
    ...overrides,
  });
}

let root;
function mount(app) {
  root = document.createElement('div');
  document.body.appendChild(root);
  render(h(AuthScreen, { app, onLogin: vi.fn() }), root);
  return root;
}

// Preact flushes effects on a timer/rAF tick, not a microtask.
const flush = async () => {
  await new Promise((r) => setTimeout(r, 20));
  await Promise.resolve();
};

afterEach(() => {
  if (root) {
    render(null, root);
    root.remove();
    root = null;
  }
  vi.useRealTimers();
});

describe('AuthScreen flow discovery', () => {
  it('shows the SSO button for the prefilled homeserver without any input event', async () => {
    const app = makeApp();
    mount(app);
    await flush();
    expect(root.querySelector('#sso-btn')).toBeTruthy();
    expect(app.MatrixClient.getLoginFlows).toHaveBeenCalled();
  });

  it('keeps the password form usable and offers a retry when the probe fails', async () => {
    const app = makeApp();
    app.MatrixClient.getLoginFlows.mockRejectedValueOnce(new Error('probe blip'));
    mount(app);
    await flush();

    expect(root.querySelector('#username').disabled).toBe(false);
    const hint = root.querySelector('#probe-failed-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toMatch(/sign-in methods/i);

    hint.querySelector('button').click();
    await flush();
    expect(root.querySelector('#probe-failed-hint')).toBeNull();
    expect(root.querySelector('#sso-btn')).toBeTruthy();
  });

  it('keeps a previously discovered SSO button when a later probe blips', async () => {
    const app = makeApp();
    mount(app);
    await flush();
    expect(root.querySelector('#sso-btn')).toBeTruthy();

    app.MatrixClient.getLoginFlows.mockRejectedValueOnce(new Error('blip'));
    const hs = root.querySelector('#hs-url');
    hs.value = 'https://matrix.org ';
    hs.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(root.querySelector('#sso-btn')).toBeTruthy();
    expect(root.querySelector('#username').disabled).toBe(false);
  });
});

describe('AuthScreen login rate limit', () => {
  it('disables the submit button for retry_after_ms with a countdown', async () => {
    vi.useFakeTimers();
    const app = makeApp();
    const rateLimited = Object.assign(new Error('limited'), {
      errcode: 'M_LIMIT_EXCEEDED',
      data: { retry_after_ms: 3000 },
      friendly: 'Server rate limit reached.',
    });
    app.MatrixClient.login.mockRejectedValue(rateLimited);
    mount(app);
    await vi.advanceTimersByTimeAsync(20);

    root.querySelector('#username').value = 'alice';
    root.querySelector('#password').value = 'hunter2';
    root.querySelector('#login-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.advanceTimersByTimeAsync(20);

    const submit = root.querySelector('button[type="submit"]');
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toMatch(/try again in \d+s/i);

    await vi.advanceTimersByTimeAsync(3200);
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toMatch(/sign in/i);
  });
});

describe('create account entry', () => {
  it('swaps to the RegisterPanel and back to the sign-in form', async () => {
    const app = makeApp();
    /** @type {any} */ (app.MatrixClient).register = vi.fn().mockResolvedValue({
      done: false,
      uia: { session: 's', flows: [{ stages: ['m.login.dummy'] }], params: {} },
    });
    const el = mount(app);
    await flush();

    const toggle = el.querySelector('#show-register-btn');
    expect(toggle).not.toBeNull();
    toggle.click();
    await flush();
    expect(el.textContent).toContain('Create an account');
    expect(el.querySelector('#login-form')).toBeNull();

    el.querySelector('#register-back').click();
    await flush();
    expect(el.querySelector('#login-form')).not.toBeNull();
  });
});
