/**
 * Invite link builders. Two links come out of one room-state read: the
 * MatrixVTT player link (opens the app, which walks the player through
 * sign-in or account creation and then joins), and the matrix.to link
 * for players who already run a Matrix client.
 */

import { viaServersFor } from '../utils/matrix-ids.js';
import { canonicalAliasFrom } from './invite-player.js';

function defaultBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) return import.meta.env.BASE_URL;
  return '/';
}

function defaultOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function buildInviteLink(target, via = []) {
  const base = `https://matrix.to/#/${encodeURIComponent(target)}`;
  if (via.length === 0) return base;
  const params = via.map((s) => `via=${encodeURIComponent(s)}`).join('&');
  return `${base}?${params}`;
}

/**
 * @param {string} target
 * @param {string[]} [via]
 * @param {{ origin?: string, base?: string }} [linkOptions]
 */
export function appJoinLink(target, via = [], linkOptions = {}) {
  const { origin, base } = linkOptions;
  if (typeof target !== 'string' || !target) return null;
  const root = base ?? defaultBase();
  const dir = root.endsWith('/') ? root : `${root}/`;
  const params = new URLSearchParams();
  params.set('join', target);
  for (const server of via) params.append('via', server);
  return `${origin ?? defaultOrigin()}${dir}app.html?${params}`;
}

export function buildShareMessage({ roomName, playerLink }) {
  const name = roomName ? `"${roomName}"` : 'a MatrixVTT campaign';
  return `Join my MatrixVTT game ${name}: ${playerLink}\n`
    + 'Sign in with a Matrix account, or create a free one on the way in.';
}

/**
 * @returns {Promise<{target: string, via: string[], playerLink: string, matrixToLink: string} | null>}
 */
export async function roomInviteLinks(manager, linkOptions = {}) {
  let alias;
  try {
    alias = canonicalAliasFrom(await manager.getRoomState());
  } catch {
    alias = null;
  }
  const target = alias || manager.roomId;
  if (!target) return null;
  // Aliases resolve on their own; bare room IDs need the via hint.
  const via = alias ? [] : viaServersFor(target);
  return {
    target,
    via,
    playerLink: appJoinLink(target, via, linkOptions),
    matrixToLink: buildInviteLink(target, via),
  };
}
