/**
 * A player who opens an `app.html?join=...` invite link has to get
 * through sign-in or account creation before the join can run, so the
 * target is parked in localStorage and consumed once the shell has an
 * authenticated client.
 *
 * localStorage rather than sessionStorage: creating a Matrix account on
 * matrix.org means a detour to element.io in another tab, and a
 * session-scoped park died there. The short expiry bounds the cost of
 * the wider scope - an invite nobody used stops applying the next day.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { parseRoomTarget } from './room-target.js';
import { confirmAndEnterRoom } from './discovery/room-preview.js';

const KEY = STORAGE_KEYS.PENDING_INVITE;

export const PENDING_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

function normalize(target, via) {
  const parsed = parseRoomTarget(target);
  if (parsed.ok === false) return null;
  const hints = Array.isArray(via) ? via.filter((s) => typeof s === 'string' && s) : [];
  return { target: parsed.target, via: parsed.via.length ? parsed.via : hints };
}

/**
 * @returns {{invite: {target: string, via: string[]} | null, error: string}}
 */
export function readInviteFromUrl(location) {
  const params = new URLSearchParams(location?.search || '');
  const join = params.get('join');
  if (!join) return { invite: null, error: '' };
  const invite = normalize(join, params.getAll('via'));
  if (invite) return { invite, error: '' };
  return {
    invite: null,
    error: `That invite link points at "${join}", which isn't a Matrix room ID (!room:server), alias (#room:server) or matrix.to link. Ask whoever sent it for a fresh link.`,
  };
}

export function savePendingInvite(invite, storage = window.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ ...invite, ts: Date.now() }));
  } catch {
    // Private browsing can refuse storage; the player can still paste
    // the link into the join field.
  }
}

export function loadPendingInvite(storage = window.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(KEY) || 'null');
    if (!stored) return null;
    if (typeof stored.ts === 'number' && Date.now() - stored.ts > PENDING_INVITE_TTL_MS) {
      clearPendingInvite(storage);
      return null;
    }
    return normalize(stored.target, stored.via);
  } catch {
    return null;
  }
}

export function clearPendingInvite(storage = window.localStorage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * Run a parked invite against a signed-in client. Cleared before the
 * join so a failed attempt does not loop on the next screen change.
 */
export async function consumePendingInvite(app) {
  const invite = loadPendingInvite();
  if (!invite) return false;
  clearPendingInvite();
  await confirmAndEnterRoom(app, invite.target, invite.target, false, invite.via);
  return true;
}
