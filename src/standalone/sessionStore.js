import { STORAGE_KEYS } from '../utils/constants.js';

const RECENT_SESSIONS_KEY = STORAGE_KEYS.RECENT_SESSIONS;
const AUTH_SESSION_KEY = STORAGE_KEYS.AUTH_SESSION;

export function loadRecentSessions(storage = window.localStorage) {
  try {
    return JSON.parse(storage.getItem(RECENT_SESSIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRecentSessions(sessions, storage = window.localStorage) {
  storage.setItem(RECENT_SESSIONS_KEY, JSON.stringify(sessions));
}

export function upsertRecentSession(entry, storage = window.localStorage) {
  const sessions = loadRecentSessions(storage);
  const idx = sessions.findIndex(s => s.userId === entry.userId && s.roomId === entry.roomId);
  const storedEntry = {
    homeserver: entry.homeserver,
    userId: entry.userId,
    displayName: entry.displayName,
    roomId: entry.roomId,
    roomName: entry.roomName,
    lastUsed: Date.now()
  };
  if (idx >= 0) sessions[idx] = storedEntry;
  else sessions.push(storedEntry);
  sessions.sort((a, b) => b.lastUsed - a.lastUsed);
  saveRecentSessions(sessions, storage);
  return storedEntry;
}

export function removeRecentSession(userId, roomId, storage = window.localStorage) {
  saveRecentSessions(
    loadRecentSessions(storage).filter(s => !(s.userId === userId && s.roomId === roomId)),
    storage
  );
}

export function clearRecentSessionsForUser(userId, storage = window.localStorage) {
  saveRecentSessions(loadRecentSessions(storage).filter(s => s.userId !== userId), storage);
}

// Auth and active-room records live in localStorage so a login survives
// browser restarts (the same trust model Element Web uses for its access
// token). Older builds kept them in sessionStorage; loads adopt such a
// legacy record once and remove it, and saves always clear the legacy key
// so logout can never leave a token behind.

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function isCompleteAuth(auth) {
  return !!auth
    && typeof auth.homeserver === 'string' && auth.homeserver !== ''
    && typeof auth.accessToken === 'string' && auth.accessToken !== ''
    && typeof auth.userId === 'string' && auth.userId !== '';
}

export function loadAuthSession(storage = window.localStorage, legacyStorage = window.sessionStorage) {
  const current = readJson(storage, AUTH_SESSION_KEY);
  if (isCompleteAuth(current)) return current;
  const legacy = readJson(legacyStorage, AUTH_SESSION_KEY);
  if (isCompleteAuth(legacy)) {
    saveAuthSession(legacy, storage, legacyStorage);
    return readJson(storage, AUTH_SESSION_KEY);
  }
  return null;
}

/**
 * Persist (or clear, with `null`) the auth session. Returns false when
 * the storage write is blocked (private browsing, quota) so the caller
 * can keep the in-memory session and warn instead of crashing mid-login.
 */
export function saveAuthSession(auth, storage = window.localStorage, legacyStorage = window.sessionStorage) {
  try {
    legacyStorage.removeItem(AUTH_SESSION_KEY);
    if (!auth) {
      storage.removeItem(AUTH_SESSION_KEY);
      return true;
    }
    storage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      homeserver: auth.homeserver,
      accessToken: auth.accessToken,
      userId: auth.userId,
      displayName: auth.displayName
    }));
    return true;
  } catch {
    return false;
  }
}

function isActiveRoom(room) {
  return !!room && typeof room.roomId === 'string' && room.roomId !== '';
}

export function loadActiveRoom(storage = window.localStorage, legacyStorage = window.sessionStorage) {
  const current = readJson(storage, STORAGE_KEYS.ACTIVE_ROOM);
  if (isActiveRoom(current)) return current;
  const legacy = readJson(legacyStorage, STORAGE_KEYS.ACTIVE_ROOM);
  if (isActiveRoom(legacy)) {
    saveActiveRoom(legacy, storage, legacyStorage);
    return legacy;
  }
  return null;
}

export function saveActiveRoom(room, storage = window.localStorage, legacyStorage = window.sessionStorage) {
  legacyStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM);
  if (!room) {
    storage.removeItem(STORAGE_KEYS.ACTIVE_ROOM);
    return;
  }
  storage.setItem(STORAGE_KEYS.ACTIVE_ROOM, JSON.stringify(room));
}

