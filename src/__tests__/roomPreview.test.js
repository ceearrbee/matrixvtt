/**
 * previewRoom assembles the pre-join summary the RoomPreviewModal
 * shows to the user. It must degrade gracefully when the homeserver
 * returns 403 (private room, no permission to read state) without
 * throwing - the modal then shows a "details hidden" copy.
 */
import { describe, it, expect, vi } from 'vitest';
import { previewRoom } from '../standalone/discovery/room-preview.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeClient(overrides = {}) {
  return {
    getRoomName: vi.fn(async (id) => id),
    getVttState: vi.fn(async () => null),
    getRoomState: vi.fn(async () => []),
    getRoomMembers: vi.fn(async () => []),
    resolveRoomAlias: vi.fn(async (alias) => alias.replace('#', '!').replace(':', '_room:')),
    ...overrides,
  };
}

describe('previewRoom', () => {
  it('returns full preview for an accessible VTT room', async () => {
    const state = [
      { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } },
      { type: 'm.room.member', state_key: '@a:hs', content: { membership: 'join' } },
      { type: 'm.room.member', state_key: '@b:hs', content: { membership: 'join' } },
      { type: EVENT_TYPES.CHARACTER, state_key: 'c1', content: { name: 'Aragorn' } },
      { type: EVENT_TYPES.NPC, state_key: 'n1', content: { name: 'Orc' } },
    ];
    const client = makeClient({
      getRoomName: vi.fn(async () => 'The Tavern'),
      getVttState: vi.fn(async () => ({
        name: 'Lost Mines', system: 'dnd5e', gm_user_ids: ['@gm:hs'],
      })),
      getRoomState: vi.fn(async () => state),
      getRoomMembers: vi.fn(async () => [{}, {}, {}]),
    });

    const p = await previewRoom(client, '!room:hs');

    expect(p.accessible).toBe(true);
    expect(p.name).toBe('The Tavern');
    expect(p.memberCount).toBe(3);
    expect(p.vtt).toEqual({
      campaignName: 'Lost Mines', system: 'dnd5e', gmIds: ['@gm:hs'],
    });
    expect(p.characters).toEqual([{ id: 'c1', name: 'Aragorn' }]);
    expect(p.npcs).toEqual([{ id: 'n1', name: 'Orc' }]);
    expect(p.joinRule).toBe('public');
  });

  it('marks accessible:false when state read returns empty (403 path)', async () => {
    const client = makeClient(); // all defaults: no name, no state, no vtt
    const p = await previewRoom(client, '!secret:hs');
    expect(p.accessible).toBe(false);
    expect(p.vtt).toBe(null);
    expect(p.characters).toEqual([]);
    expect(p.npcs).toEqual([]);
  });

  it('falls back to counting m.room.member when getRoomMembers is empty', async () => {
    const state = [
      { type: 'm.room.member', state_key: '@a:hs', content: { membership: 'join' } },
      { type: 'm.room.member', state_key: '@b:hs', content: { membership: 'join' } },
      { type: 'm.room.member', state_key: '@c:hs', content: { membership: 'leave' } },
    ];
    const client = makeClient({ getRoomState: vi.fn(async () => state) });
    const p = await previewRoom(client, '!room:hs');
    expect(p.memberCount).toBe(2);
  });

  it('skips tombstoned characters/npcs (empty content)', async () => {
    const state = [
      { type: EVENT_TYPES.CHARACTER, state_key: 'c1', content: { name: 'Live' } },
      { type: EVENT_TYPES.CHARACTER, state_key: 'c2', content: {} },
    ];
    const client = makeClient({ getRoomState: vi.fn(async () => state) });
    const p = await previewRoom(client, '!room:hs');
    expect(p.characters).toEqual([{ id: 'c1', name: 'Live' }]);
  });

  it('resolves an alias before fetching', async () => {
    const client = makeClient();
    await previewRoom(client, '#room:hs');
    expect(client.resolveRoomAlias).toHaveBeenCalledWith('#room:hs');
    expect(client.getRoomName).toHaveBeenCalledWith('!room_room:hs');
  });

  it('returns notFound when alias resolution fails', async () => {
    const client = makeClient({
      resolveRoomAlias: vi.fn(async () => { throw Object.assign(new Error('not found'), { errcode: 'M_NOT_FOUND' }); }),
    });
    const p = await previewRoom(client, '#typo:hs');
    expect(p.accessible).toBe(false);
    expect(p.notFound).toBe(true);
  });
});
