import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadActiveRoom,
  loadAuthSession,
  loadRecentSessions,
  removeRecentSession,
  saveActiveRoom,
  saveAuthSession,
  upsertRecentSession
} from '../standalone/sessionStore.js';
import { STORAGE_KEYS } from '../utils/constants.js';

const AUTH = {
  homeserver: 'https://matrix.example.com',
  accessToken: 'secret-token',
  userId: '@user:example.com',
  displayName: 'User'
};

describe('standalone session store', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('auth session', () => {
    it('persists auth in localStorage so it survives browser restarts', () => {
      saveAuthSession(AUTH);

      expect(loadAuthSession()).toEqual(AUTH);
      expect(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toContain('secret-token');
      expect(sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
    });

    it('saveAuthSession reports success with a boolean', () => {
      expect(saveAuthSession(AUTH)).toBe(true);
      expect(saveAuthSession(null)).toBe(true);
    });

    it('saveAuthSession returns false instead of throwing when storage writes fail', () => {
      const blocked = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => { throw new Error('SecurityError'); },
      };
      expect(() => saveAuthSession(AUTH, blocked, blocked)).not.toThrow();
      expect(saveAuthSession(AUTH, blocked, blocked)).toBe(false);
    });

    it('adopts a legacy sessionStorage session once and removes it', () => {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(AUTH));

      expect(loadAuthSession()).toEqual(AUTH);
      expect(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toContain('secret-token');
      expect(sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
    });

    it('prefers the localStorage session when both storages have one', () => {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(AUTH));
      sessionStorage.setItem(
        STORAGE_KEYS.AUTH_SESSION,
        JSON.stringify({ ...AUTH, accessToken: 'stale-legacy-token' })
      );

      expect(loadAuthSession()?.accessToken).toBe('secret-token');
    });

    it('returns null for corrupt stored JSON', () => {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, '{not json');
      expect(loadAuthSession()).toBeNull();
    });

    it('returns null for a partial session missing required fields', () => {
      localStorage.setItem(
        STORAGE_KEYS.AUTH_SESSION,
        JSON.stringify({ homeserver: 'https://matrix.example.com', userId: '@user:example.com' })
      );
      expect(loadAuthSession()).toBeNull();
    });

    it('falls back to a valid legacy session when the stored one is corrupt', () => {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, '{not json');
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(AUTH));

      expect(loadAuthSession()).toEqual(AUTH);
    });

    it('saveAuthSession(null) clears both current and legacy entries', () => {
      saveAuthSession(AUTH);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(AUTH));

      saveAuthSession(null);

      expect(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION)).toBeNull();
      expect(loadAuthSession()).toBeNull();
    });
  });

  describe('active room', () => {
    it('persists the active room in localStorage', () => {
      saveActiveRoom({ roomId: '!room:example.com', roomName: 'Campaign' });

      expect(loadActiveRoom()).toEqual({ roomId: '!room:example.com', roomName: 'Campaign' });
      expect(sessionStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM)).toBeNull();
    });

    it('adopts a legacy sessionStorage active room and removes it', () => {
      sessionStorage.setItem(
        STORAGE_KEYS.ACTIVE_ROOM,
        JSON.stringify({ roomId: '!room:example.com', roomName: 'Campaign' })
      );

      expect(loadActiveRoom()?.roomId).toBe('!room:example.com');
      expect(sessionStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM)).toContain('!room:example.com');
    });

    it('returns null for corrupt or roomId-less records', () => {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM, '{not json');
      expect(loadActiveRoom()).toBeNull();

      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM, JSON.stringify({ roomName: 'No ID' }));
      expect(loadActiveRoom()).toBeNull();
    });

    it('saveActiveRoom(null) clears both current and legacy entries', () => {
      saveActiveRoom({ roomId: '!room:example.com', roomName: 'Campaign' });
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM, JSON.stringify({ roomId: '!room:example.com' }));

      saveActiveRoom(null);

      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM)).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM)).toBeNull();
    });
  });

  it('persists recent sessions without access tokens', () => {
    upsertRecentSession({
      homeserver: 'https://matrix.example.com',
      accessToken: 'should-not-be-stored',
      userId: '@user:example.com',
      displayName: 'User',
      roomId: '!room:example.com',
      roomName: 'Campaign'
    });

    expect(loadRecentSessions()).toEqual([
      expect.objectContaining({
        homeserver: 'https://matrix.example.com',
        userId: '@user:example.com',
        displayName: 'User',
        roomId: '!room:example.com',
        roomName: 'Campaign'
      })
    ]);
    expect(localStorage.getItem(STORAGE_KEYS.RECENT_SESSIONS)).not.toContain('should-not-be-stored');
  });

  it('removes only the targeted recent session', () => {
    upsertRecentSession({
      homeserver: 'https://matrix.example.com',
      userId: '@user:example.com',
      displayName: 'User',
      roomId: '!one:example.com',
      roomName: 'One'
    });
    upsertRecentSession({
      homeserver: 'https://matrix.example.com',
      userId: '@user:example.com',
      displayName: 'User',
      roomId: '!two:example.com',
      roomName: 'Two'
    });

    removeRecentSession('@user:example.com', '!one:example.com');

    expect(loadRecentSessions()).toHaveLength(1);
    expect(loadRecentSessions()[0].roomId).toBe('!two:example.com');
  });
});
