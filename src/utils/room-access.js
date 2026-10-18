/**
 * What a room's state says about who can read it. MatrixVTT does not
 * support encrypted rooms, and nothing it stores in a room is private
 * from that room's members. A public room adds anyone who joins.
 */

import { EVENT_TYPES } from './constants.js';

export const ENCRYPTED_ROOM_MESSAGE =
  'This room is encrypted. MatrixVTT does not support encrypted rooms, so it cannot open it. ' +
  'You can still use the room in Element or another Matrix app.';

export const READABLE_ROOM_NOTICE =
  'Treat this room as public. Everyone in it can read everything MatrixVTT stores here, ' +
  'including GM notes, private pages and whispers, from any Matrix app.';

export const PUBLIC_ROOM_NOTICE = 'This is a public room: anyone can join and read it.';

/** @param {any} content - an m.room.encryption event's content */
function hasEncryptionAlgorithm(content) {
  return typeof content?.algorithm === 'string';
}

/** @param {unknown} stateEvents */
export function isRoomEncrypted(stateEvents) {
  if (!Array.isArray(stateEvents)) return false;
  return stateEvents.some((e) =>
    e?.type === EVENT_TYPES.ROOM_ENCRYPTION && hasEncryptionAlgorithm(e.content));
}

/**
 * Encryption and join rule for one room, from a reader that returns a
 * state event's content or null. A read that fails counts as
 * unencrypted with an unknown rule: the VTT then opens, and an
 * encrypted send fails loudly instead of the room being hidden.
 *
 * @param {(type: string) => Promise<any>} readContent
 * @returns {Promise<{ encrypted: boolean, joinRule: string|null }>}
 */
export async function readRoomAccess(readContent) {
  const [encryption, joinRules] = await Promise.all([
    readContent(EVENT_TYPES.ROOM_ENCRYPTION),
    readContent(EVENT_TYPES.JOIN_RULES),
  ]);
  const rule = joinRules?.join_rule;
  return {
    encrypted: hasEncryptionAlgorithm(encryption),
    joinRule: typeof rule === 'string' ? rule : null,
  };
}

/**
 * Room access through a standalone MatrixClient, whose
 * getStateEventContent returns null for a missing or unreadable event.
 * @param {{ getStateEventContent: (roomId: string, type: string, stateKey: string) => Promise<any> }} client
 * @param {string} roomId
 */
export function roomAccessFor(client, roomId) {
  return readRoomAccess((type) => client.getStateEventContent(roomId, type, ''));
}

/** @param {string|null|undefined} joinRule */
export function isPublicJoinRule(joinRule) {
  return joinRule === 'public';
}
