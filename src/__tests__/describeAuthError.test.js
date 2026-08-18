/**
 * `describeAuthError` translates raw Matrix homeserver errors into the
 * friendly, actionable copy a new user can act on. Sister to
 * `_describeJoinError` in session.js, but covers the auth-flow
 * errcodes (bad password, rate limit, expired token, deactivated).
 */
import { describe, it, expect } from 'vitest';
import { describeAuthError } from '../standalone/auth-errors.js';

const err = (errcode, message = '') => Object.assign(new Error(message || errcode), { errcode });

describe('describeAuthError', () => {
  it('M_FORBIDDEN - bad credentials', () => {
    expect(describeAuthError(err('M_FORBIDDEN'))).toMatch(/wrong username or password/i);
  });

  it('M_LIMIT_EXCEEDED - rate limit', () => {
    expect(describeAuthError(err('M_LIMIT_EXCEEDED'))).toMatch(/rate limit|wait/i);
  });

  it('M_USER_DEACTIVATED', () => {
    expect(describeAuthError(err('M_USER_DEACTIVATED'))).toMatch(/deactivated/i);
  });

  it('M_UNKNOWN_TOKEN / M_MISSING_TOKEN - expired session', () => {
    expect(describeAuthError(err('M_UNKNOWN_TOKEN'))).toMatch(/session has expired|sign in again/i);
    expect(describeAuthError(err('M_MISSING_TOKEN'))).toMatch(/session has expired|sign in again/i);
  });

  it('falls back to err.message for unknown errcodes', () => {
    expect(describeAuthError(err('M_GIBBERISH', 'something exploded'))).toContain('something exploded');
  });

  it('translates connection failures into reachability copy, not raw SDK text', () => {
    const shapes = [
      Object.assign(new Error('fetch failed'), { name: 'ConnectionError' }),
      new TypeError('Failed to fetch'),
      new Error('NetworkError when attempting to fetch resource'),
    ];
    for (const e of shapes) {
      expect(describeAuthError(e, { context: 'login' })).toMatch(/could not reach the homeserver/i);
    }
  });

  it('prefers errcode copy over network-shape sniffing', () => {
    const e = Object.assign(new Error('fetch failed'), { errcode: 'M_FORBIDDEN' });
    expect(describeAuthError(e)).toMatch(/wrong username or password/i);
  });

  it('gives the join context reachability copy too', () => {
    const e = new TypeError('Failed to fetch');
    expect(describeAuthError(e, { context: 'join', target: '!r:hs' })).toMatch(/could not reach/i);
  });

  it('falls back to a generic message when err is undefined / null', () => {
    expect(describeAuthError(null)).toMatch(/login failed/i);
    expect(describeAuthError(undefined)).toMatch(/login failed/i);
  });

  it('reads errcode from .data.errcode (Matrix-spec response shape)', () => {
    const e = Object.assign(new Error('forbidden'), { data: { errcode: 'M_FORBIDDEN' } });
    expect(describeAuthError(e)).toMatch(/wrong username or password/i);
  });

  it('contextualises join errors when {context: "join"} is given', () => {
    expect(describeAuthError(err('M_FORBIDDEN'), { context: 'join', target: '!r:hs' }))
      .toMatch(/private and you have no invite/i);
  });
});

describe('register context', () => {
  const err = (errcode) => Object.assign(new Error(errcode), { errcode });

  it('maps the registration errcodes to actionable copy', () => {
    expect(describeAuthError(err('M_USER_IN_USE'), { context: 'register' }))
      .toMatch(/taken|in use/i);
    expect(describeAuthError(err('M_INVALID_USERNAME'), { context: 'register' }))
      .toMatch(/username/i);
    expect(describeAuthError(err('M_WEAK_PASSWORD'), { context: 'register' }))
      .toMatch(/password/i);
    expect(describeAuthError(err('M_THREEPID_IN_USE'), { context: 'register' }))
      .toMatch(/email/i);
    expect(describeAuthError(err('M_THREEPID_DENIED'), { context: 'register' }))
      .toMatch(/email/i);
    expect(describeAuthError(err('M_FORBIDDEN'), { context: 'register' }))
      .toMatch(/registration/i);
  });

  it('keeps the shared fallbacks (rate limit, network)', () => {
    expect(describeAuthError(err('M_LIMIT_EXCEEDED'), { context: 'register' }))
      .toMatch(/rate limit/i);
    expect(describeAuthError(new TypeError('fetch failed'), { context: 'register' }))
      .toMatch(/could not reach/i);
  });
});
