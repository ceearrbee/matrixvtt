/**
 * invite-player.js - pure helpers behind the invite modal. The GM action
 * itself lives in InvitePlayerModal.jsx; standalone mode delegates the
 * invite to the /invite endpoint via ClientManager, widget mode writes
 * the m.room.member state event through the same capability kick/ban
 * already use.
 */

import { EVENT_TYPES } from '../utils/constants.js';

export function isValidMatrixUserId(input) {
  if (typeof input !== 'string') return false;
  return /^@[^:@\s]+:\S+$/.test(input.trim());
}

export function describeInviteError(err) {
  const code = err?.errcode || err?.data?.errcode;
  if (code === 'M_FORBIDDEN') {
    return "You don't have permission to invite to this room, or the user is already a member.";
  }
  if (code === 'M_LIMIT_EXCEEDED') {
    return 'Server rate limit reached. Wait a moment and try again.';
  }
  if (code === 'M_NOT_FOUND' || code === 'M_UNKNOWN') {
    return 'No user with that ID was found. Check the spelling and homeserver.';
  }
  return err?.message ? `Invite failed: ${err.message}` : 'Invite failed. Try again.';
}

export function joinRuleFrom(stateEvents) {
  if (!Array.isArray(stateEvents)) return null;
  const rule = stateEvents.find((e) => e?.type === EVENT_TYPES.JOIN_RULES)?.content?.join_rule;
  return typeof rule === 'string' ? rule : null;
}

export function canonicalAliasFrom(stateEvents) {
  if (!Array.isArray(stateEvents)) return null;
  const event = stateEvents.find((e) => e?.type === EVENT_TYPES.CANONICAL_ALIAS);
  const alias = event?.content?.alias;
  return typeof alias === 'string' && alias.startsWith('#') ? alias : null;
}
