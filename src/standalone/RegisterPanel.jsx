/**
 * RegisterPanel - in-app Matrix account creation over UIA.
 *
 * The flow machine lives in registration-flow.js; this panel drives
 * the HTTP rounds through app.MatrixClient.register so the e2e fake
 * can stand in for a homeserver. Servers whose every flow needs
 * recaptcha (matrix.org) get the element.io exit instead: the Google
 * script origins it needs are outside the static-site CSP.
 */

import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { describeAuthError } from './auth-errors.js';
import {
  beginFlow, nextStage, applyUiaUpdate, termsPolicies, authDictFor,
} from './registration-flow.js';

const ELEMENT_REGISTER_URL = 'https://app.element.io/#/register';

function makeClientSecret() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `mxvtt-${Date.now().toString(36)}`;
}

export function RegisterPanel({ app, onLogin, onBack, initialHs = 'https://matrix.org' }) {
  const [flow, setFlow] = useState(null);
  const [probing, setProbing] = useState(true);
  const [probeError, setProbeError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailWait, setEmailWait] = useState(false);

  const hsRef = useRef(app.resolvedHs || initialHs);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const tokenRef = useRef(null);
  const emailRef = useRef(null);
  const termsRef = useRef(null);
  const flowRef = useRef(null);
  const credsRef = useRef({ username: '', password: '', token: '', email: '' });
  const sidRef = useRef(null);
  const secretRef = useRef(makeClientSecret());
  const attemptRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const hs = app.resolvedHs || (await app.MatrixClient.discoverHomeserver(initialHs));
        hsRef.current = hs;
        const res = await app.MatrixClient.register(hs, {});
        if (res.done) {
          setProbeError('This server answered the probe unexpectedly. Sign up in another client.');
        } else {
          const f = beginFlow(res.uia);
          flowRef.current = f;
          setFlow(f);
        }
      } catch (err) {
        setProbeError(describeAuthError(err, { context: 'register' }));
      } finally {
        setProbing(false);
      }
    })();
  }, []);

  const finish = async (credentials) => {
    const { username, password } = credsRef.current;
    let creds = credentials;
    if (!creds?.access_token) {
      creds = await app.MatrixClient.login(hsRef.current, username, password);
    }
    const client = new app.MatrixClient({
      homeserver: hsRef.current,
      accessToken: creds.access_token,
      userId: creds.user_id,
    });
    const profile = await client.getProfile(creds.user_id).catch(() => ({}));
    onLogin({
      homeserver: hsRef.current,
      accessToken: creds.access_token,
      userId: creds.user_id,
      displayName: profile.displayname || creds.user_id,
      client,
    });
  };

  const runStages = async () => {
    setError('');
    setBusy(true);
    try {
      let f = flowRef.current;
      const { username, password, token, email } = credsRef.current;
      const body = { username, password, initial_device_display_name: 'MatrixVTT' };
      for (;;) {
        const stage = nextStage(f);
        if (stage === 'm.login.email.identity' && !sidRef.current) {
          attemptRef.current += 1;
          const { sid } = await app.MatrixClient.requestRegisterEmailToken(
            hsRef.current, email, secretRef.current, attemptRef.current);
          sidRef.current = sid;
          setEmailWait(true);
          return;
        }
        const extras = { token, sid: sidRef.current, clientSecret: secretRef.current };
        const res = await app.MatrixClient.register(
          hsRef.current,
          stage ? { ...body, auth: authDictFor(stage, f, extras) } : body,
        );
        if (res.done) {
          await finish(res.credentials);
          return;
        }
        const updated = applyUiaUpdate(f, res.uia);
        flowRef.current = updated;
        setFlow(updated);
        if (stage && !updated.completed.includes(stage)) {
          if (stage === 'm.login.email.identity') {
            setError('Email not verified yet. Click the link in the email, then continue.');
          } else if (stage === 'm.login.registration_token') {
            setError('That registration token was not accepted.');
          } else {
            setError('The server rejected this step. Try again.');
          }
          return;
        }
        f = updated;
      }
    } catch (err) {
      setError(describeAuthError(err, { context: 'register' }));
    } finally {
      setBusy(false);
    }
  };

  const stages = flow?.stages ?? [];
  const needsToken = stages.includes('m.login.registration_token');
  const needsEmail = stages.includes('m.login.email.identity');
  const needsTerms = stages.includes('m.login.terms');
  const policies = needsTerms ? termsPolicies(flow.params) : [];

  const submit = (e) => {
    e.preventDefault();
    const username = usernameRef.current?.value.trim() ?? '';
    const password = passwordRef.current?.value ?? '';
    const token = tokenRef.current?.value.trim() ?? '';
    const email = emailRef.current?.value.trim() ?? '';
    if (!username) return setError('Username is required.');
    if (!password) return setError('Password is required.');
    if (needsToken && !token) return setError('Registration token is required.');
    if (needsEmail && !email) return setError('Email address is required.');
    if (needsTerms && !termsRef.current?.checked) return setError('Accept the terms to continue.');
    credsRef.current = { username, password, token, email };
    runStages();
  };

  const resendEmail = async () => {
    setError('');
    attemptRef.current += 1;
    try {
      const { sid } = await app.MatrixClient.requestRegisterEmailToken(
        hsRef.current, credsRef.current.email, secretRef.current, attemptRef.current);
      sidRef.current = sid;
    } catch (err) {
      setError(describeAuthError(err, { context: 'register' }));
    }
  };

  const backButton = h('button', {
    type: 'button', class: 'dbt', id: 'register-back', onClick: onBack,
  }, '← Back to sign in');

  if (probing) {
    return h('div', { class: 'auth-card' }, [
      h('h2', { class: 'auth-heading' }, 'Create an account'),
      h('p', { class: 'auth-intro', role: 'status' }, 'Checking this server\'s sign-up requirements…'),
      backButton,
    ]);
  }

  if (probeError) {
    return h('div', { class: 'auth-card' }, [
      h('h2', { class: 'auth-heading' }, 'Create an account'),
      h('div', { class: 'auth-error visible', role: 'alert' }, probeError),
      backButton,
    ]);
  }

  if (flow && !flow.supported) {
    return h('div', { class: 'auth-card' }, [
      h('h2', { class: 'auth-heading' }, 'Create an account'),
      h('p', { class: 'auth-intro' },
        'This server requires a verification step (CAPTCHA) that this app cannot run. Sign up in another client, then come back and sign in.'),
      h('p', null, [
        h('a', {
          href: ELEMENT_REGISTER_URL, target: '_blank', rel: 'noopener noreferrer',
        }, 'Create the account at element.io →'),
      ]),
      backButton,
    ]);
  }

  if (emailWait) {
    return h('div', { class: 'auth-card' }, [
      h('h2', { class: 'auth-heading' }, 'Check your email'),
      h('p', { class: 'auth-intro' },
        `We sent a verification link to ${credsRef.current.email}. Click it, then continue here.`),
      error && h('div', { class: 'auth-error visible', role: 'alert' }, error),
      h('div', { class: 'form-actions register-email-actions' }, [
        h('button', {
          type: 'button', class: 'dbt btn-primary', disabled: busy, onClick: runStages,
        }, 'I\'ve verified, continue'),
        h('button', {
          type: 'button', class: 'dbt', disabled: busy, onClick: resendEmail,
        }, 'Resend email'),
      ]),
      backButton,
    ]);
  }

  return h('div', { class: 'auth-card' }, [
    h('h2', { class: 'auth-heading' }, 'Create an account'),
    h('p', { class: 'auth-intro' }, `New account on ${hsRef.current.replace(/^https?:\/\//, '')}.`),
    h('form', { id: 'register-form', onSubmit: submit, novalidate: true }, [
      h('label', { for: 'register-username' }, 'Username'),
      h('input', {
        id: 'register-username', class: 'form-input', type: 'text',
        autocomplete: 'username', ref: usernameRef,
      }),
      h('label', { for: 'register-password' }, 'Password'),
      h('input', {
        id: 'register-password', class: 'form-input', type: 'password',
        autocomplete: 'new-password', ref: passwordRef,
      }),
      needsEmail && h('label', { for: 'register-email' }, 'Email address'),
      needsEmail && h('input', {
        id: 'register-email', class: 'form-input', type: 'text',
        autocomplete: 'email', ref: emailRef,
      }),
      needsToken && h('label', { for: 'register-token' }, 'Registration token'),
      needsToken && h('input', {
        id: 'register-token', class: 'form-input', type: 'text',
        autocomplete: 'off', ref: tokenRef,
        placeholder: 'Ask the server admin for this',
      }),
      needsTerms && h('div', { class: 'register-terms' }, [
        h('label', { class: 'form-check-row' }, [
          h('input', { type: 'checkbox', id: 'register-terms', ref: termsRef }),
          h('span', null, 'I accept the server\'s terms:'),
        ]),
        h('ul', { class: 'register-terms__list' }, policies.map((p) => h('li', { key: p.url },
          h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' }, p.name)))),
      ]),
      error && h('div', { class: 'auth-error visible', role: 'alert' }, error),
      h('button', { type: 'submit', class: 'dbt btn-primary', disabled: busy },
        busy ? 'Creating…' : 'Create account'),
    ]),
    backButton,
  ]);
}
