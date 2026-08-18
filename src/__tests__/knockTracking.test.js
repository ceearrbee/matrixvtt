/**
 * GM-side knock surfacing - state layer.
 *
 * m.room.member events with membership 'knock' collect in
 * sm.pendingKnocks so the GM can approve (invite) or deny (kick).
 * Any later membership for that user resolves the knock, and a
 * refresh clears the list along with every other collection.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleMemberEvent } from '../state/syncer.js';
import { clearAllCollections } from '../state/syncer-load.js';

function makeSm(knocks = []) {
  return {
    roomMembers: [],
    pendingKnocks: [...knocks],
    widgetManager: { getRateLimitWait: () => 0 },
  };
}

function memberEvent(userId, membership, extra = {}) {
  return {
    type: 'm.room.member',
    state_key: userId,
    content: { membership, ...extra },
    event_id: `$ev-${userId}-${membership}`,
  };
}

describe('pending knock tracking', () => {
  it('collects a knock with displayname and reason', () => {
    const sm = makeSm();
    handleMemberEvent(sm, memberEvent('@ann:hs', 'knock', { displayname: 'Ann', reason: 'party invite' }));
    expect(sm.pendingKnocks).toEqual([
      { userId: '@ann:hs', displayname: 'Ann', reason: 'party invite' },
    ]);
  });

  it('updates rather than duplicates a repeat knock from the same user', () => {
    const sm = makeSm([{ userId: '@ann:hs', displayname: 'Ann', reason: 'old' }]);
    handleMemberEvent(sm, memberEvent('@ann:hs', 'knock', { displayname: 'Ann', reason: 'new' }));
    expect(sm.pendingKnocks).toHaveLength(1);
    expect(sm.pendingKnocks[0].reason).toBe('new');
  });

  it('resolves the knock when the user is invited, joins, leaves, or is banned', () => {
    for (const membership of ['invite', 'join', 'leave', 'ban']) {
      const sm = makeSm([{ userId: '@ann:hs', displayname: 'Ann', reason: '' }]);
      handleMemberEvent(sm, memberEvent('@ann:hs', membership));
      expect(sm.pendingKnocks, membership).toEqual([]);
    }
  });

  it('a knock never lands in roomMembers', () => {
    const sm = makeSm();
    handleMemberEvent(sm, memberEvent('@ann:hs', 'knock', { displayname: 'Ann' }));
    expect(sm.roomMembers).toEqual([]);
  });

  it('clearAllCollections resets pendingKnocks', () => {
    const sm = {
      tokens: new Map(), characters: new Map(), npcs: new Map(),
      items: new Map(), spells: new Map(), handouts: new Map(),
      pages: new Map(), tables: new Map(), pins: new Map(),
      templates: new Map(), walls: new Map(), lights: new Map(),
      maps: new Map(),
      drawings: [], roomMembers: [], damageLog: [], activeMapId: null,
      pendingKnocks: [{ userId: '@ann:hs', displayname: 'Ann', reason: '' }],
    };
    clearAllCollections(sm);
    expect(sm.pendingKnocks).toEqual([]);
  });
});

describe('refreshPendingKnocks (initial load)', () => {
  it('loads knocks for a user who can edit room state', async () => {
    const { refreshPendingKnocks } = await import('../state/lifecycle.js');
    const sm = makeSm();
    sm.widgetManager = {
      canEditRoomState: async () => true,
      getPendingKnocks: async () => [{ userId: '@ann:hs', displayname: 'Ann', reason: '' }],
    };
    await refreshPendingKnocks(sm);
    expect(sm.pendingKnocks).toHaveLength(1);
  });

  it('skips the read entirely for players', async () => {
    const { refreshPendingKnocks } = await import('../state/lifecycle.js');
    const sm = makeSm();
    const getPendingKnocks = vi.fn();
    sm.widgetManager = { canEditRoomState: async () => false, getPendingKnocks };
    await refreshPendingKnocks(sm);
    expect(getPendingKnocks).not.toHaveBeenCalled();
    expect(sm.pendingKnocks).toEqual([]);
  });
});
