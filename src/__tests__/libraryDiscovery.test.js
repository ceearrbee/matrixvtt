import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isLibraryMarker,
  findLibraryRoom,
  ensureLibraryRoom,
} from '../library/discovery.js';
import { EVENT_TYPES } from '../utils/constants.js';

function stubClient({ joined = [], markers = {}, created = 'room:new' } = {}) {
  return {
    userId: '@me:hs',
    getJoinedRooms: vi.fn(async () => joined),
    getStateEventContent: vi.fn(async (roomId, type, key) => {
      if (type !== EVENT_TYPES.LIBRARY_MARKER || key !== '') return null;
      return markers[roomId] ?? null;
    }),
    createRoom: vi.fn(async () => created),
  };
}

describe('isLibraryMarker', () => {
  it('accepts a versioned marker object', () => {
    expect(isLibraryMarker({ vtt_version: 1 })).toBe(true);
  });
  it('rejects null and non-objects', () => {
    expect(isLibraryMarker(null)).toBe(false);
    expect(isLibraryMarker('x')).toBe(false);
  });
});

describe('findLibraryRoom', () => {
  beforeEach(() => localStorage.clear());

  it('returns a verified cached room without scanning', async () => {
    const client = stubClient({ markers: { 'room:lib': { vtt_version: 1 } } });
    localStorage.setItem(`vtt:library-room::${client.userId}`, 'room:lib');
    const found = await findLibraryRoom(client);
    expect(found).toBe('room:lib');
    expect(client.getJoinedRooms).not.toHaveBeenCalled();
  });

  it('rescans when the cached room no longer has the marker', async () => {
    const client = stubClient({
      joined: ['room:a', 'room:lib'],
      markers: { 'room:lib': { vtt_version: 1 } },
    });
    localStorage.setItem(`vtt:library-room::${client.userId}`, 'room:stale');
    const found = await findLibraryRoom(client);
    expect(found).toBe('room:lib');
    expect(client.getJoinedRooms).toHaveBeenCalled();
    expect(localStorage.getItem(`vtt:library-room::${client.userId}`)).toBe('room:lib');
  });

  it('scans joined rooms for the marker and caches the hit', async () => {
    const client = stubClient({
      joined: ['room:a', 'room:lib'],
      markers: { 'room:lib': { vtt_version: 1 } },
    });
    const found = await findLibraryRoom(client);
    expect(found).toBe('room:lib');
    expect(localStorage.getItem(`vtt:library-room::${client.userId}`)).toBe('room:lib');
  });

  it('returns null when no room carries the marker', async () => {
    const client = stubClient({ joined: ['room:a', 'room:b'] });
    expect(await findLibraryRoom(client)).toBeNull();
  });
});

describe('ensureLibraryRoom', () => {
  beforeEach(() => localStorage.clear());

  it('returns the existing library room without creating one', async () => {
    const client = stubClient({
      joined: ['room:lib'],
      markers: { 'room:lib': { vtt_version: 1 } },
    });
    const id = await ensureLibraryRoom(client);
    expect(id).toBe('room:lib');
    expect(client.createRoom).not.toHaveBeenCalled();
  });

  it('creates a marked room and caches it when none exists', async () => {
    const client = stubClient({ joined: [], created: 'room:fresh' });
    const id = await ensureLibraryRoom(client);
    expect(id).toBe('room:fresh');
    const [, opts] = client.createRoom.mock.calls[0];
    const marker = opts.initialState.find((e) => e.type === EVENT_TYPES.LIBRARY_MARKER);
    expect(marker).toBeTruthy();
    expect(localStorage.getItem(`vtt:library-room::${client.userId}`)).toBe('room:fresh');
  });
});
