/**
 * A player who opens an `app.html?join=...` invite link has to get
 * through sign-in or account creation before the join can run, so the
 * target is parked in sessionStorage and consumed once the shell has an
 * authenticated client.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { parseRoomTarget } from './room-target.js';
import { confirmAndEnterRoom } from './discovery/room-preview.js';

const KEY = STORAGE_KEYS.PENDING_INVITE;

function normalize(target, via) {
  const parsed = parseRoomTarget(target);
  if (parsed.ok === false) return null;
  const hints = Array.isArray(via) ? via.filter((s) => typeof s === 'string' && s) : [];
  return { target: parsed.target, via: parsed.via.length ? parsed.via : hints };
}

export function readInviteFromUrl(location) {
  const params = new URLSearchParams(location?.search || '');
  const join = params.get('join');
  return join ? normalize(join, params.getAll('via')) : null;
}

export function savePendingInvite(invite, storage = window.sessionStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(invite));
  } catch {
    // Private browsing can refuse storage; the player can still paste
    // the link into the join field.
  }
}

export function loadPendingInvite(storage = window.sessionStorage) {
  try {
    const stored = JSON.parse(storage.getItem(KEY) || 'null');
    return stored ? normalize(stored.target, stored.via) : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(storage = window.sessionStorage) {
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
