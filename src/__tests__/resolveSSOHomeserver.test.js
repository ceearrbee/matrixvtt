/**
 * Security: the SSO callback URL is attacker-controllable
 * (?hs=https://evil.example&loginToken=…). The homeserver used to
 * complete login must come from sessionStorage, written before the
 * redirect, so a crafted callback can't redirect login to a malicious
 * homeserver.
 */
import { describe, it, expect } from 'vitest';
import { resolveSSOHomeserver } from '../standalone/auth.js';

describe('resolveSSOHomeserver', () => {
  it('returns the session homeserver when the URL has no hs param', () => {
    expect(resolveSSOHomeserver(null, 'https://matrix.org')).toBe('https://matrix.org');
  });

  it('returns the session homeserver when URL hs matches', () => {
    expect(resolveSSOHomeserver('https://matrix.org', 'https://matrix.org'))
      .toBe('https://matrix.org');
  });

  it('returns null when URL hs disagrees with the stashed session hs', () => {
    expect(resolveSSOHomeserver('https://evil.example', 'https://matrix.org')).toBeNull();
  });

  it('returns null when no session hs was stashed (no recovery from URL alone)', () => {
    expect(resolveSSOHomeserver('https://matrix.org', null)).toBeNull();
    expect(resolveSSOHomeserver('https://matrix.org', '')).toBeNull();
  });

  it('rejects non-https stashed values to refuse plaintext credential flow', () => {
    expect(resolveSSOHomeserver(null, 'http://matrix.org')).toBeNull();
    expect(resolveSSOHomeserver(null, 'javascript:alert(1)')).toBeNull();
  });
});
