/**
 * Token Move Permission Tests
 *
 * Tests StateManager.canMoveToken() directly - the single source of truth for
 * whether a user may drag, move, or enter movement mode on a token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';

// Stub heavy dependencies so we can instantiate StateManager in isolation
vi.mock('../widget/SubscriptionManager.js', () => ({
  SubscriptionManager: class {
    constructor() { this.subscriptions = new Map(); }
    subscribe() {}
    destroy() {}
    unsubscribeAll() {}
  }
}));

vi.mock('../utils/schemas.js', () => ({
  validateStateEvent: vi.fn(),
  stateEventsEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

vi.mock('../utils/errorHandling.js', () => ({
  withErrorHandling: vi.fn(),
  ErrorType: {}
}));

function makeState({ userId, gmUserIds = [], gm = false } = {}) {
  const widgetManager = {
    userId,
    isStandalone: true,
    widgetApi: null,
    isGM: vi.fn().mockReturnValue(false),
    roomId: '!test:server',
    sendStateEvent: vi.fn().mockResolvedValue({}),
  };
  const state = new StateManager(widgetManager);
  state.settings = { gm_user_ids: gmUserIds };
  if (gm) state.powerLevels = { users: { [userId]: 50 } };
  return state;
}

describe('StateManager.canMoveToken', () => {
  describe('GM can move any token', () => {
    it('moves unowned token', () => {
      const state = makeState({ userId: '@gm:server', gm: true });
      state.tokens.set('tok-1', { owner_user_id: null });
      expect(state.canMoveToken('tok-1')).toBe(true);
    });

    it('moves player-owned token', () => {
      const state = makeState({ userId: '@gm:server', gm: true });
      state.tokens.set('tok-1', { owner_user_id: '@player:server' });
      expect(state.canMoveToken('tok-1')).toBe(true);
    });
  });

  describe('owner can move their own token', () => {
    it('allows matching owner', () => {
      const state = makeState({ userId: '@player:server' });
      state.tokens.set('tok-1', { owner_user_id: '@player:server' });
      expect(state.canMoveToken('tok-1')).toBe(true);
    });

    it('denies different player', () => {
      const state = makeState({ userId: '@player:server' });
      state.tokens.set('tok-1', { owner_user_id: '@other:server' });
      expect(state.canMoveToken('tok-1')).toBe(false);
    });
  });

  describe('null/undefined ownership prevents bypass', () => {
    it('denies when owner_user_id is null', () => {
      const state = makeState({ userId: '@player:server' });
      state.tokens.set('tok-1', { owner_user_id: null });
      expect(state.canMoveToken('tok-1')).toBe(false);
    });

    it('denies when owner_user_id is undefined', () => {
      const state = makeState({ userId: '@player:server' });
      state.tokens.set('tok-1', {});
      expect(state.canMoveToken('tok-1')).toBe(false);
    });

    it('denies when userId is null and owner is also null (null !== null guard)', () => {
      const state = makeState({ userId: null });
      state.tokens.set('tok-1', { owner_user_id: null });
      expect(state.canMoveToken('tok-1')).toBe(false);
    });

    it('denies when userId is undefined and no owner set', () => {
      const state = makeState({ userId: undefined });
      state.tokens.set('tok-1', { owner_user_id: '@player:server' });
      expect(state.canMoveToken('tok-1')).toBe(false);
    });
  });

  describe('missing token', () => {
    it('returns false for unknown tokenId', () => {
      const state = makeState({ userId: '@gm:server', gm: true });
      expect(state.canMoveToken('nonexistent')).toBe(false);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// isGM() tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StateManager.isGM', () => {
  it('returns true when power level is 50', () => {
    const state = makeState({ userId: '@gm:server', gm: true });
    expect(state.isGM()).toBe(true);
  });

  it('returns true when power level is above 50', () => {
    const state = makeState({ userId: '@gm:server' });
    state.powerLevels = { users: { '@gm:server': 100 } };
    expect(state.isGM()).toBe(true);
  });

  it('returns false when power level is below 50', () => {
    const state = makeState({ userId: '@player:server' });
    state.powerLevels = { users: { '@player:server': 25 } };
    expect(state.isGM()).toBe(false);
  });

  it('returns false when powerLevels has not arrived', () => {
    const state = makeState({ userId: '@gm:server' });
    expect(state.isGM()).toBe(false);
  });

  it('gm_user_ids alone does not grant GM', () => {
    const state = makeState({ userId: '@gm:server', gmUserIds: ['@gm:server'] });
    expect(state.isGM()).toBe(false);
  });

  it('falls back to users_default when the user has no explicit entry', () => {
    const state = makeState({ userId: '@anyone:server' });
    state.powerLevels = { users: {}, users_default: 50 };
    expect(state.isGM()).toBe(true);
  });

  it("does not use another user's power level", () => {
    const state = makeState({ userId: '@player:server' });
    state.powerLevels = { users: { '@gm:server': 100 } };
    expect(state.isGM()).toBe(false);
  });

  it('returns true for the third GM among several elevated users', () => {
    const state = makeState({ userId: '@carol:s' });
    state.powerLevels = { users: { '@alice:s': 50, '@bob:s': 50, '@carol:s': 50 } };
    expect(state.isGM()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canEditEntity() tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StateManager.canEditEntity', () => {
  it('returns true when entity is owned via player_user_id matching current user', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({ player_user_id: '@player:server' })).toBe(true);
  });

  it('returns true when entity is claimed via claimed_by_user_id matching current user', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({ claimed_by_user_id: '@player:server' })).toBe(true);
  });

  it('returns false when entity is owned by a different player', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({ player_user_id: '@other:server' })).toBe(false);
  });

  it('returns false when entity has no owner (GM-only entity)', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({ player_user_id: null, claimed_by_user_id: null })).toBe(false);
  });

  it('returns false for undefined entity fields when not GM', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({})).toBe(false);
  });

  it('GM can edit entity owned by another player', () => {
    const state = makeState({ userId: '@gm:server', gm: true });
    expect(state.canEditEntity({ player_user_id: '@player:server' })).toBe(true);
  });

  it('GM can edit entity with no owner', () => {
    const state = makeState({ userId: '@gm:server', gm: true });
    expect(state.canEditEntity({ player_user_id: null })).toBe(true);
  });

  it('returns false when entity is null and user is not GM', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity(null)).toBe(false);
  });
});

describe('StateManager.canMoveToken - ownership boundaries', () => {
  it('player cannot move token with owner_user_id: null (explicit null)', () => {
    const state = makeState({ userId: '@player:server' });
    state.tokens.set('tok-1', { owner_user_id: null });
    expect(state.canMoveToken('tok-1')).toBe(false);
  });

  it('player cannot move token with owner_user_id: undefined', () => {
    const state = makeState({ userId: '@player:server' });
    state.tokens.set('tok-1', { owner_user_id: undefined });
    expect(state.canMoveToken('tok-1')).toBe(false);
  });

  it('missing powerLevels makes isGM() false so player cannot move unowned token', () => {
    const state = makeState({ userId: '@player:server' });
    state.tokens.set('tok-1', { owner_user_id: null });
    expect(state.canMoveToken('tok-1')).toBe(false);
  });
});

describe('canEditEntity - ownership boundaries', () => {
  it('player_user_id is empty string does not match non-empty userId', () => {
    const state = makeState({ userId: '@player:server' });
    expect(state.canEditEntity({ player_user_id: '', claimed_by_user_id: '' })).toBe(false);
  });
});

describe('isGM - matching behavior', () => {
  it('case-sensitive: "@GM:server" !== "@gm:server"', () => {
    const state = makeState({ userId: '@GM:server' });
    state.powerLevels = { users: { '@gm:server': 50 } };
    expect(state.isGM()).toBe(false);
  });
});
