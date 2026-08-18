/**
 * getPendingKnocks() parity: both room managers expose the same
 * read of m.room.member events with membership 'knock', mapped to
 * { userId, displayname, reason } for the GM approval list.
 */

import { describe, it, expect, vi } from 'vitest';
import { ClientManager } from '../client/ClientManager.js';
import { getPendingKnocks as adapterGetPendingKnocks } from '../widget/room-adapter.js';

function knockMember(userId, displayname = '', reason = '') {
  return {
    type: 'm.room.member',
    state_key: userId,
    content: { membership: 'knock', displayname, reason },
  };
}

describe('ClientManager.getPendingKnocks', () => {
  it('maps knock members from the sdk room', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.roomId = '!r:hs';
    cm._client = {
      sdk: {
        getRoom: () => ({
          getMembersWithMembership: (m) => m === 'knock'
            ? [{
                userId: '@ann:hs',
                name: 'Ann',
                events: { member: { getContent: () => ({ membership: 'knock', reason: 'let me in' }) } },
              }]
            : [],
        }),
      },
    };
    expect(await cm.getPendingKnocks()).toEqual([
      { userId: '@ann:hs', displayname: 'Ann', reason: 'let me in' },
    ]);
  });

  it('returns [] when the room is not loaded', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.roomId = '!r:hs';
    cm._client = { sdk: { getRoom: () => null } };
    expect(await cm.getPendingKnocks()).toEqual([]);
  });
});

describe('room-adapter getPendingKnocks (widget mode)', () => {
  it('filters knock member events out of the state read', async () => {
    const receiveStateEvents = vi.fn(async () => [
      knockMember('@ann:hs', 'Ann', 'let me in'),
      { type: 'm.room.member', state_key: '@gm:hs', content: { membership: 'join' } },
    ]);
    const wm = { widgetApi: { receiveStateEvents }, roomId: '!r:hs', _roomIdsSupported: null };
    expect(await adapterGetPendingKnocks(wm)).toEqual([
      { userId: '@ann:hs', displayname: 'Ann', reason: 'let me in' },
    ]);
  });

  it('returns [] in standalone or without a widgetApi', async () => {
    expect(await adapterGetPendingKnocks({ isStandalone: true })).toEqual([]);
    expect(await adapterGetPendingKnocks({ widgetApi: null })).toEqual([]);
  });
});
