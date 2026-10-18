/**
 * What a room's state says about who can read it. MatrixVTT does not
 * support encrypted rooms, and a public room can be read by anyone who
 * joins.
 */
import { describe, it, expect } from 'vitest';
import { isRoomEncrypted, isPublicJoinRule } from '../utils/room-access.js';

const encryption = { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } };

describe('isRoomEncrypted', () => {
  it('is true when the room carries an encryption algorithm', () => {
    expect(isRoomEncrypted([encryption])).toBe(true);
  });

  it('is false for a room with no encryption event', () => {
    expect(isRoomEncrypted([{ type: 'm.room.name', state_key: '', content: { name: 'Tavern' } }])).toBe(false);
    expect(isRoomEncrypted([])).toBe(false);
  });

  it('is false when the state could not be read', () => {
    expect(isRoomEncrypted(null)).toBe(false);
    expect(isRoomEncrypted(undefined)).toBe(false);
  });

  it('ignores an encryption event with no algorithm', () => {
    expect(isRoomEncrypted([{ type: 'm.room.encryption', state_key: '', content: {} }])).toBe(false);
  });
});

describe('isPublicJoinRule', () => {
  it('is true only for the public join rule', () => {
    expect(isPublicJoinRule('public')).toBe(true);
    expect(isPublicJoinRule('invite')).toBe(false);
    expect(isPublicJoinRule('knock')).toBe(false);
    expect(isPublicJoinRule(null)).toBe(false);
  });
});
