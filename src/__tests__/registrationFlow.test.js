/**
 * Pure UIA registration flow machine (no DOM, no network).
 *
 * Supported stages are the script-free ones: dummy, terms,
 * registration token, email. recaptcha needs Google script origins
 * the static CSP forbids, so flows requiring it are unsupported and
 * the UI keeps the element.io exit.
 */

import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_STAGES, pickSupportedFlow, beginFlow, nextStage,
  applyUiaUpdate, termsPolicies, authDictFor,
} from '../standalone/registration-flow.js';

const UIA = {
  session: 'sess1',
  flows: [
    { stages: ['m.login.recaptcha', 'm.login.dummy'] },
    { stages: ['m.login.registration_token', 'm.login.terms'] },
  ],
  params: {
    'm.login.terms': {
      policies: {
        privacy_policy: {
          version: '1.0',
          en: { name: 'Privacy Policy', url: 'https://hs.example/privacy' },
        },
      },
    },
  },
};

describe('pickSupportedFlow', () => {
  it('skips recaptcha flows and picks the first fully supported one', () => {
    expect(pickSupportedFlow(UIA.flows)).toEqual(['m.login.registration_token', 'm.login.terms']);
  });

  it('returns null when every flow needs an unsupported stage', () => {
    expect(pickSupportedFlow([{ stages: ['m.login.recaptcha'] }])).toBeNull();
    expect(pickSupportedFlow([])).toBeNull();
    expect(pickSupportedFlow(undefined)).toBeNull();
  });

  it('the supported set is exactly the script-free stages', () => {
    expect([...SUPPORTED_STAGES].sort()).toEqual([
      'm.login.dummy', 'm.login.email.identity',
      'm.login.registration_token', 'm.login.terms',
    ]);
  });
});

describe('beginFlow / nextStage / applyUiaUpdate', () => {
  it('beginFlow captures session, params, and the chosen stages', () => {
    const flow = beginFlow(UIA);
    expect(flow.session).toBe('sess1');
    expect(flow.supported).toBe(true);
    expect(flow.stages).toEqual(['m.login.registration_token', 'm.login.terms']);
    expect(nextStage(flow)).toBe('m.login.registration_token');
  });

  it('beginFlow marks unsupported servers', () => {
    const flow = beginFlow({ session: 's', flows: [{ stages: ['m.login.recaptcha'] }] });
    expect(flow.supported).toBe(false);
    expect(nextStage(flow)).toBeNull();
  });

  it('applyUiaUpdate advances past completed stages', () => {
    let flow = beginFlow(UIA);
    flow = applyUiaUpdate(flow, { session: 'sess1', completed: ['m.login.registration_token'] });
    expect(nextStage(flow)).toBe('m.login.terms');
    flow = applyUiaUpdate(flow, { session: 'sess1', completed: ['m.login.registration_token', 'm.login.terms'] });
    expect(nextStage(flow)).toBeNull();
  });
});

describe('termsPolicies', () => {
  it('flattens the policy map into name/url pairs', () => {
    expect(termsPolicies(UIA.params)).toEqual([
      { name: 'Privacy Policy', url: 'https://hs.example/privacy' },
    ]);
  });

  it('returns [] when the server declares no policies', () => {
    expect(termsPolicies({})).toEqual([]);
    expect(termsPolicies(undefined)).toEqual([]);
  });
});

describe('authDictFor', () => {
  const flow = { session: 'sess1' };

  it('dummy and terms carry only type and session', () => {
    expect(authDictFor('m.login.dummy', flow)).toEqual({ type: 'm.login.dummy', session: 'sess1' });
    expect(authDictFor('m.login.terms', flow)).toEqual({ type: 'm.login.terms', session: 'sess1' });
  });

  it('registration token rides in the auth dict', () => {
    expect(authDictFor('m.login.registration_token', flow, { token: 'LETMEIN' }))
      .toEqual({ type: 'm.login.registration_token', session: 'sess1', token: 'LETMEIN' });
  });

  it('email identity carries the threepid creds', () => {
    expect(authDictFor('m.login.email.identity', flow, { sid: 'sid9', clientSecret: 'cs' }))
      .toEqual({
        type: 'm.login.email.identity', session: 'sess1',
        threepid_creds: { sid: 'sid9', client_secret: 'cs' },
      });
  });
});
