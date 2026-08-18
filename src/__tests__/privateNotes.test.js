/**
 * Per-user private notes - local-only scratchpad keyed by
 * (userId, roomId, entityId). Truly private: never synced to Matrix;
 * stored in localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getPrivateNote, setPrivateNote } from '../utils/private-notes.js';

beforeEach(() => { localStorage.clear(); });

describe('private notes', () => {
  it('round-trips a note for one entity', () => {
    setPrivateNote('@me:hs', '!room:hs', 'char-1', 'remember the king is a doppelgänger');
    expect(getPrivateNote('@me:hs', '!room:hs', 'char-1'))
      .toBe('remember the king is a doppelgänger');
  });

  it('returns empty string for entities never annotated', () => {
    expect(getPrivateNote('@me:hs', '!room:hs', 'char-unknown')).toBe('');
  });

  it('isolates by user - another user\'s notes are invisible', () => {
    setPrivateNote('@gm:hs', '!room:hs', 'char-1', 'GM-only secret');
    expect(getPrivateNote('@me:hs', '!room:hs', 'char-1')).toBe('');
    expect(getPrivateNote('@gm:hs', '!room:hs', 'char-1')).toBe('GM-only secret');
  });

  it('isolates by room - same user, different room', () => {
    setPrivateNote('@me:hs', '!room-a:hs', 'char-1', 'note A');
    setPrivateNote('@me:hs', '!room-b:hs', 'char-1', 'note B');
    expect(getPrivateNote('@me:hs', '!room-a:hs', 'char-1')).toBe('note A');
    expect(getPrivateNote('@me:hs', '!room-b:hs', 'char-1')).toBe('note B');
  });

  it('empty body deletes the entry (subsequent get returns empty)', () => {
    setPrivateNote('@me:hs', '!r:hs', 'c1', 'something');
    setPrivateNote('@me:hs', '!r:hs', 'c1', '');
    expect(getPrivateNote('@me:hs', '!r:hs', 'c1')).toBe('');
  });

  it('handles missing userId / roomId gracefully (no crash)', () => {
    expect(() => setPrivateNote(null, '!r:hs', 'c', 'x')).not.toThrow();
    expect(getPrivateNote(null, '!r:hs', 'c')).toBe('');
  });
});
