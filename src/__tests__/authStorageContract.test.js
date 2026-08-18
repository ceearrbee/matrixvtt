/**
 * Lock-in contract for credential-at-rest storage.
 *
 * `sessionStore.js#saveAuthSession` persists the access token to
 * `localStorage` so a login survives browser restarts - the same trust
 * model Element Web uses. The token is fully cleared on explicit
 * logout (`saveAuthSession(null)`), including any legacy copy left in
 * `sessionStorage` by older builds. The recent-sessions index in
 * localStorage holds only non-secret metadata (homeserver + user/room
 * IDs + display name + lastUsed).
 *
 * These tests prevent silent regressions in either direction:
 *   - logout leaving a token behind in either storage
 *   - the recent-sessions index accidentally including a token field
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAuthSession,
  loadAuthSession,
  upsertRecentSession,
  loadRecentSessions,
} from '../standalone/sessionStore.js';
import { STORAGE_KEYS } from '../utils/constants.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth-session storage contract', () => {
  it('persists access tokens in localStorage so sessions survive restarts', () => {
    saveAuthSession({
      homeserver: 'https://matrix.example.org',
      accessToken: 'syt_secret_token_123',
      userId: '@u:example.org',
      displayName: 'U',
    });
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toContain('syt_secret_token_123');
    expect(sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
  });

  it('round-trips through localStorage', () => {
    const session = {
      homeserver: 'https://matrix.example.org',
      accessToken: 'syt_xyz',
      userId: '@u:example.org',
      displayName: 'U',
    };
    saveAuthSession(session);
    expect(loadAuthSession()).toEqual(session);
  });

  it('saveAuthSession(null) leaves no token in either storage', () => {
    saveAuthSession({
      homeserver: 'h', accessToken: 't', userId: '@u:example.org', displayName: 'U',
    });
    sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify({
      homeserver: 'h', accessToken: 'legacy-token', userId: '@u:example.org',
    }));
    saveAuthSession(null);
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
    expect(loadAuthSession()).toBeNull();
  });
});

describe('recent-sessions storage contract', () => {
  it('never stores a token in localStorage even when one is passed in', () => {
    upsertRecentSession({
      homeserver: 'https://matrix.example.org',
      userId: '@u:example.org',
      displayName: 'U',
      roomId: '!room:example.org',
      roomName: 'Game',
      // A future caller might accidentally pass a token here; the
      // store should drop it on its own.
      accessToken: 'syt_must_not_be_persisted',
    });
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SESSIONS);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('syt_must_not_be_persisted');
    expect(raw).not.toContain('accessToken');
  });

  it('persists only homeserver + user/room IDs + display + lastUsed', () => {
    upsertRecentSession({
      homeserver: 'https://matrix.example.org',
      userId: '@u:example.org',
      displayName: 'U',
      roomId: '!room:example.org',
      roomName: 'Game',
    });
    const [entry] = loadRecentSessions();
    expect(Object.keys(entry).sort()).toEqual(
      ['displayName', 'homeserver', 'lastUsed', 'roomId', 'roomName', 'userId'].sort(),
    );
  });
});
