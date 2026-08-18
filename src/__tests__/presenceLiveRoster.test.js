/**
 * Live room member roster - handleMemberEvent
 *
 * When m.room.member state events arrive via sync, handleMemberEvent()
 * assigns a fresh sm.roomMembers array (which is a signal-backed
 * accessor in production, so the assignment publishes).
 * - membership: 'join'  → add or update entry
 * - membership: 'leave' | 'ban' → remove entry
 */

import { describe, it, expect } from 'vitest';
import { handleMemberEvent } from '../state/syncer.js';

function makeSm(initial = []) {
  return {
    roomMembers: [...initial],
    widgetManager: { getRateLimitWait: () => 0 },
  };
}

function memberEvent(userId, membership, displayname = '') {
  return {
    type: 'm.room.member',
    state_key: userId,
    content: { membership, displayname },
    event_id: `$ev-${userId}-${membership}`,
  };
}

describe('handleMemberEvent', () => {
  it('adds a new joined member to roomMembers', () => {
    const sm = makeSm();
    handleMemberEvent(sm, memberEvent('@alice:example.com', 'join', 'Alice'));
    expect(sm.roomMembers).toHaveLength(1);
    expect(sm.roomMembers[0].userId).toBe('@alice:example.com');
    expect(sm.roomMembers[0].displayname).toBe('Alice');
  });

  it('updates displayname for an already-joined member', () => {
    const sm = makeSm([{ userId: '@alice:example.com', displayname: 'Old Name' }]);
    handleMemberEvent(sm, memberEvent('@alice:example.com', 'join', 'New Name'));
    expect(sm.roomMembers).toHaveLength(1);
    expect(sm.roomMembers[0].displayname).toBe('New Name');
  });

  it('removes a member on leave', () => {
    const sm = makeSm([
      { userId: '@alice:example.com', displayname: 'Alice' },
      { userId: '@bob:example.com',   displayname: 'Bob' },
    ]);
    handleMemberEvent(sm, memberEvent('@alice:example.com', 'leave'));
    expect(sm.roomMembers).toHaveLength(1);
    expect(sm.roomMembers[0].userId).toBe('@bob:example.com');
  });

  it('removes a member on ban', () => {
    const sm = makeSm([{ userId: '@alice:example.com', displayname: 'Alice' }]);
    handleMemberEvent(sm, memberEvent('@alice:example.com', 'ban'));
    expect(sm.roomMembers).toHaveLength(0);
  });

  it('does nothing for unknown membership values', () => {
    const sm = makeSm([{ userId: '@alice:example.com', displayname: 'Alice' }]);
    handleMemberEvent(sm, memberEvent('@alice:example.com', 'invite'));
    expect(sm.roomMembers).toHaveLength(1); // unchanged
  });
});
