/**
 * AuthScreen.jsx - Standalone login screen.
 *
 * Handles homeserver discovery, login with password/token, and SSO.
 */

import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { normalizeHomeserver } from './auth.js';
import { loginRetryAfterMs } from './auth-errors.js';
import { RegisterPanel } from './RegisterPanel.jsx';
import { FEEDBACK_MATRIX, matrixUrl } from '../utils/feedback-contacts.js';

export function AuthScreen({ app, onLogin, externalError = '' }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoVisible, setSsoVisible] = useState(false);
  const [passwordDisabled, setPasswordDisabled] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [showRegister, setShowRegister] = useState(false);
  const [registerHs, setRegisterHs] = useState('https://matrix.org');

  const hsUrlRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const accessTokenRef = useRef(null);
  const retryTimerRef = useRef(null);

  const updateLoginFlows = async () => {
    const hs = hsUrlRef.current?.value.trim();
    if (!hs) return;
    try {
      const resolved = await app.MatrixClient.discoverHomeserver(hs);
      const flows = await app.MatrixClient.getLoginFlows(resolved);
      const hasSSO = flows.some((f) => f.type === 'm.login.sso');
      const hasPassword = flows.some((f) => f.type === 'm.login.password');
      app.resolvedHs = resolved;
      setSsoVisible(hasSSO);
      setPasswordDisabled(!hasPassword);
      setProbeFailed(false);
    } catch {
      // Soft failure: never lock the password form, never hide a
      // previously discovered SSO button - only this probe blipped.
      app.resolvedHs = null;
      setPasswordDisabled(false);
      setProbeFailed(true);
    }
  };

  // The field is prefilled with matrix.org and most users never edit
  // it, so the probe must run on mount or SSO users see no SSO button.
  useEffect(() => {
    updateLoginFlows();
    return () => clearInterval(retryTimerRef.current);
  }, []);

  const startRetryCountdown = (waitMs) => {
    clearInterval(retryTimerRef.current);
    setRetrySeconds(Math.ceil(waitMs / 1000));
    retryTimerRef.current = setInterval(() => {
      setRetrySeconds((s) => {
        if (s <= 1) {
          clearInterval(retryTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    app.setLoginError?.('');

    const hsRaw = hsUrlRef.current.value;
    const username = usernameRef.current.value.trim();
    const password = passwordRef.current.value;
    const token = accessTokenRef.current.value.trim();

    const hs = normalizeHomeserver(hsRaw);
    if (!hs) return setError('Homeserver URL is required.');
    if (!/^https?:\/\//i.test(hs)) {
      return setError('Homeserver URL must use https:// (or http:// for local servers).');
    }
    if (!token) {
      if (!username) return setError('Username is required.');
      if (!password) return setError('Password is required.');
    }

    setLoading(true);
    try {
      const resolvedHs = app.resolvedHs || (await app.MatrixClient.discoverHomeserver(hs));
      const authResult = token
        ? await app.MatrixClient.loginWithToken(resolvedHs, token)
        : await app.MatrixClient.login(resolvedHs, username, password);

      const client = new app.MatrixClient({
        homeserver: resolvedHs,
        accessToken: authResult.access_token,
        userId: authResult.user_id,
      });
      const profile = await client.getProfile(authResult.user_id).catch(() => ({}));
      
      const auth = {
        homeserver: resolvedHs,
        accessToken: authResult.access_token,
        userId: authResult.user_id,
        displayName: profile.displayname || authResult.user_id,
        client,
      };
      onLogin(auth);
    } catch (err) {
      setError(app.getAuthErrorMessage?.(err, { context: 'login' }) || err.message);
      const wait = loginRetryAfterMs(err);
      if (wait > 0) startRetryCountdown(wait);
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = () => {
    app.setLoginError?.('');
    const hs = app.resolvedHs || normalizeHomeserver(hsUrlRef.current.value);
    if (!hs) return setError('Homeserver URL is required.');
    // startSSOLogin reads app.resolvedHs / #hs-url itself; don't pass hs.
    app.startSSOLogin();
  };

  if (showRegister) {
    return h(RegisterPanel, {
      app,
      onLogin,
      initialHs: registerHs,
      onBack: () => setShowRegister(false),
    });
  }

  return h('div', { class: 'auth-card' }, [
    h('h2', { class: 'auth-heading' }, 'Sign in to your homeserver'),
    h('p', { class: 'auth-intro' },
      'Standalone mode connects directly to your Matrix account from this browser.'),
    h('p', { class: 'auth-beta-notice' }, [
      h('strong', null, 'Beta.'),
      ' Your Matrix homeserver stores everything (maps, characters, chat); this site stores nothing and never sees your password. Bugs or ideas? ',
      h('a', { href: matrixUrl(), target: '_blank', rel: 'noopener noreferrer' }, FEEDBACK_MATRIX),
      '.',
    ]),
    h('form', { id: 'login-form', onSubmit: handleSubmit, novalidate: true }, [
      h('label', { for: 'hs-url' }, 'Homeserver URL'),
      h('input', {
        id: 'hs-url', class: 'form-input', type: 'url',
        defaultValue: 'https://matrix.org', required: true,
        autocomplete: 'url', 'aria-describedby': 'hs-help',
        ref: hsUrlRef, onChange: updateLoginFlows
      }),
      probeFailed && h('div', { id: 'probe-failed-hint', class: 'auth-hint', role: 'status' }, [
        'Couldn\'t check this server\'s sign-in methods. ',
        h('button', { type: 'button', class: 'auth-hint__retry', onClick: updateLoginFlows }, 'Retry'),
      ]),
      h('details', { id: 'hs-help' }, [
        h('summary', null, 'What\'s a Matrix homeserver?'),
        h('p', null,
          'Matrix is a federated, open chat protocol, like email but for real-time messaging. Anyone can run a homeserver, and accounts on different servers can talk to each other.'
        ),
        h('p', null, [
          h('strong', null, 'Don\'t have an account?'), ' Use ', h('em', null, 'Create account'), ' below to sign up on the server above. The default ', h('code', null, 'matrix.org'), ' requires a CAPTCHA this app cannot run, so it sends you to ',
          h('a', { href: 'https://app.element.io/#/register', target: '_blank', rel: 'noopener' }, 'element.io →'),
          ' instead. Then come back here and sign in.'
        ])
      ]),

      h('label', { for: 'username' }, 'Username'),
      h('input', {
        id: 'username', class: 'form-input', type: 'text',
        placeholder: '@user:matrix.org', required: true,
        autocomplete: 'username', ref: usernameRef,
        disabled: passwordDisabled
      }),

      h('label', { for: 'password' }, 'Password'),
      h('input', {
        id: 'password', class: 'form-input', type: 'password',
        autocomplete: 'current-password', ref: passwordRef,
        disabled: passwordDisabled
      }),

      h('details', null, [
        h('summary', null, 'Use access token instead of password'),
        h('label', { for: 'access-token' }, 'Access Token'),
        h('input', {
          id: 'access-token', class: 'form-input', type: 'password',
          placeholder: 'syt_…', autocomplete: 'off', ref: accessTokenRef
        })
      ]),

      h('button', { type: 'submit', class: 'dbt btn-primary', disabled: loading || retrySeconds > 0 },
        retrySeconds > 0 ? `Try again in ${retrySeconds}s` : (loading ? 'Signing in…' : 'Sign In')
      ),
      ssoVisible && h('button', { type: 'button', class: 'btn-secondary', id: 'sso-btn', onClick: handleSSO }, 'Sign in with SSO'),
      h('button', {
        type: 'button', class: 'btn-secondary', id: 'show-register-btn',
        onClick: () => {
          setRegisterHs(hsUrlRef.current?.value.trim() || 'https://matrix.org');
          setShowRegister(true);
        },
      }, 'Create account'),
      (error || externalError) && h('div', { id: 'login-error', class: 'auth-error visible', role: 'alert' }, error || externalError)
    ]),
    // The data-storage disclosure lives in the sidebar
    // (`.sidebar-epilogue`) so the form stays short. On the mobile
    // collapse, the sidebar reflows above the form, so the same
    // disclosure remains discoverable without crowding the form itself.
  ]);
}
