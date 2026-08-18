/**
 * Direct unit tests for state/reader.js - pure read helpers that the
 * UI and writers both depend on. Locks in:
 *  - GM detection
 *  - canEditEntity / canMoveToken permission rules (incl. initiative)
 *  - getActiveMap fallback when settings points at a tombstoned id
 *  - isTokenVisibleToPlayer fog-of-war logic
 */
import { describe, it, expect } from 'vitest';
import {
  isGM,
  canEditEntity,
  canMoveToken,
  hasTokenForSheet,
  getCurrentCharacter,
  getActiveMap,
  isTokenVisibleToPlayer,
  getMyPowerLevel,
  canSendEventType,
} from '../reader.js';
import { EVENT_TYPES } from '../../utils/constants.js';
import { FOG_MODES } from '../../utils/ui-constants.js';

function makeSm({ userId = '@me:m', gms = [], tokens = new Map(), maps = new Map(), fog = { mode: FOG_MODES.REVEALED, revealed: [] }, initiative = { active: false } } = {}) {
  return {
    settings: { gm_user_ids: gms },
    powerLevels: { users: Object.fromEntries(gms.map((id) => [id, 50])) },
    widgetManager: { userId },
    tokens,
    characters: new Map(),
    npcs: new Map(),
    spells: new Map(),
    maps,
    fog,
    initiative,
    activeMapId: null,
    selectedToken: null,
    selectedCharacterId: null,
    selectedNPCId: null,
  };
}

describe('isGM', () => {
  it('is true at power level 50 or above', () => {
    expect(isGM(makeSm({ userId: '@gm:m', gms: ['@gm:m'] }))).toBe(true);
    const creator = makeSm({ userId: '@creator:m' });
    creator.powerLevels = { users: { '@creator:m': 100 } };
    expect(isGM(creator)).toBe(true);
  });
  it('is false below power level 50', () => {
    expect(isGM(makeSm({ userId: '@p:m', gms: ['@gm:m'] }))).toBe(false);
  });
  it('ignores gm_user_ids - a forged roster entry grants nothing', () => {
    const sm = makeSm({ userId: '@attacker:m' });
    sm.settings.gm_user_ids = ['@attacker:m'];
    expect(isGM(sm)).toBe(false);
  });
  it('is false when power levels have not arrived or userId is missing', () => {
    expect(isGM({ powerLevels: null, widgetManager: { userId: '@x:m' } })).toBe(false);
    expect(isGM(makeSm({ userId: undefined, gms: ['@gm:m'] }))).toBe(false);
  });
});

describe('canEditEntity', () => {
  it('allows GMs to edit anything', () => {
    const sm = makeSm({ userId: '@gm:m', gms: ['@gm:m'] });
    expect(canEditEntity(sm, { player_user_id: '@other:m' })).toBe(true);
  });
  it('allows the owning player', () => {
    const sm = makeSm({ userId: '@p:m' });
    expect(canEditEntity(sm, { player_user_id: '@p:m' })).toBe(true);
  });
  it('allows a player who has claimed the entity', () => {
    const sm = makeSm({ userId: '@p:m' });
    expect(canEditEntity(sm, { claimed_by_user_id: '@p:m' })).toBe(true);
  });
  it('denies an unrelated player', () => {
    const sm = makeSm({ userId: '@other:m' });
    expect(canEditEntity(sm, { player_user_id: '@p:m' })).toBe(false);
  });
});

describe('canMoveToken', () => {
  function smWithToken(token, opts = {}) {
    const tokens = new Map([['t1', token]]);
    return makeSm({ tokens, ...opts });
  }

  it('returns false when the token does not exist', () => {
    expect(canMoveToken(makeSm(), 'missing')).toBe(false);
  });

  it('lets the GM move any token', () => {
    const sm = smWithToken({ owner_user_id: '@p:m' }, { userId: '@gm:m', gms: ['@gm:m'] });
    expect(canMoveToken(sm, 't1')).toBe(true);
  });

  it('lets the owner move their own token outside combat', () => {
    const sm = smWithToken({ owner_user_id: '@p:m' }, { userId: '@p:m' });
    expect(canMoveToken(sm, 't1')).toBe(true);
  });

  it('denies non-owners', () => {
    const sm = smWithToken({ owner_user_id: '@p:m' }, { userId: '@other:m' });
    expect(canMoveToken(sm, 't1')).toBe(false);
  });

  it('during active combat, only the player whose turn it is can move their token', () => {
    const tokens = new Map([['t1', { owner_user_id: '@p:m' }]]);
    const initiative = { active: true, current_index: 0, order: [{ token_id: 't1' }, { token_id: 't2' }] };
    const onTurn = makeSm({ userId: '@p:m', tokens, initiative });
    expect(canMoveToken(onTurn, 't1')).toBe(true);

    const offTurn = makeSm({
      userId: '@p:m',
      tokens,
      initiative: { ...initiative, current_index: 1 },
    });
    expect(canMoveToken(offTurn, 't1')).toBe(false);
  });
});

describe('hasTokenForSheet / getCurrentCharacter', () => {
  it('hasTokenForSheet detects a token with the matching sheet_id', () => {
    const sm = makeSm({ tokens: new Map([['t1', { sheet_id: 'c1' }]]) });
    expect(hasTokenForSheet(sm, 'c1')).toBe(true);
    expect(hasTokenForSheet(sm, 'c-other')).toBe(false);
  });

  it('getCurrentCharacter resolves via selectedToken.sheet_id', () => {
    const sm = makeSm({ tokens: new Map([['t1', { sheet_id: 'c1' }]]) });
    sm.characters.set('c1', { name: 'Aria' });
    sm.selectedToken = 't1';
    expect(getCurrentCharacter(sm)).toEqual({ name: 'Aria' });
  });
});

describe('getActiveMap fallback', () => {
  it('returns the active map when the id points at a real map', () => {
    const sm = makeSm({ maps: new Map([['m1', { name: 'A' }]]) });
    sm.activeMapId = 'm1';
    expect(getActiveMap(sm)).toEqual({ name: 'A' });
  });

  it('falls back to the first map when activeMapId is stale (tombstoned)', () => {
    const sm = makeSm({ maps: new Map([['m1', { name: 'A' }], ['m2', { name: 'B' }]]) });
    sm.activeMapId = 'm-tombstoned';
    expect(getActiveMap(sm)?.name).toBe('A');
  });

  it('returns null when no maps exist', () => {
    expect(getActiveMap(makeSm())).toBeNull();
  });
});

describe('isTokenVisibleToPlayer', () => {
  it('GMs see every token', () => {
    const sm = makeSm({ userId: '@gm:m', gms: ['@gm:m'], fog: { mode: FOG_MODES.HIDDEN, revealed: [] } });
    expect(isTokenVisibleToPlayer(sm, { col: 0, row: 0, visible: false })).toBe(true);
  });

  it('players see their own tokens regardless of fog/visible', () => {
    const sm = makeSm({ userId: '@p:m', fog: { mode: FOG_MODES.HIDDEN, revealed: [] } });
    expect(isTokenVisibleToPlayer(sm, { owner_user_id: '@p:m', visible: false, col: 0, row: 0 })).toBe(true);
  });

  it('hides tokens with visible=false from other players', () => {
    const sm = makeSm({ userId: '@p:m', fog: { mode: FOG_MODES.REVEALED, revealed: [] } });
    expect(isTokenVisibleToPlayer(sm, { owner_user_id: '@gm:m', visible: false, col: 0, row: 0 })).toBe(false);
  });

  it('in HIDDEN fog mode, only revealed cells expose tokens to non-owners', () => {
    const fog = { mode: FOG_MODES.HIDDEN, revealed: ['5,5'] };
    const sm = makeSm({ userId: '@p:m', fog });
    expect(isTokenVisibleToPlayer(sm, { owner_user_id: '@gm:m', col: 5, row: 5, size: 1 })).toBe(true);
    expect(isTokenVisibleToPlayer(sm, { owner_user_id: '@gm:m', col: 0, row: 0, size: 1 })).toBe(false);
  });

  it('a multi-cell token is visible if any of its cells is revealed', () => {
    const fog = { mode: FOG_MODES.HIDDEN, revealed: ['6,6'] };
    const sm = makeSm({ userId: '@p:m', fog });
    expect(isTokenVisibleToPlayer(sm, { owner_user_id: '@gm:m', col: 5, row: 5, size: 2 })).toBe(true);
  });
});

describe('Matrix power-level reads', () => {
  it('getMyPowerLevel returns users[me] when set', () => {
    const sm = makeSm({ userId: '@me:m' });
    sm.powerLevels = { users: { '@me:m': 50 }, users_default: 0 };
    expect(getMyPowerLevel(sm)).toBe(50);
  });

  it('getMyPowerLevel falls back to users_default', () => {
    const sm = makeSm({ userId: '@me:m' });
    sm.powerLevels = { users: { '@gm:m': 50 }, users_default: 10 };
    expect(getMyPowerLevel(sm)).toBe(10);
  });

  it('getMyPowerLevel returns 0 when no PL state has arrived', () => {
    const sm = makeSm();
    expect(getMyPowerLevel(sm)).toBe(0);
  });

  it('canSendEventType is true when user level >= events[type] threshold', () => {
    const sm = makeSm({ userId: '@gm:m' });
    sm.powerLevels = { users: { '@gm:m': 50 }, events: { [EVENT_TYPES.WALL]: 50 } };
    expect(canSendEventType(sm, EVENT_TYPES.WALL)).toBe(true);
  });

  it('canSendEventType is false for level-0 user against a 50-required event', () => {
    const sm = makeSm({ userId: '@p:m' });
    sm.powerLevels = { users_default: 0, events: { [EVENT_TYPES.WALL]: 50 } };
    expect(canSendEventType(sm, EVENT_TYPES.WALL)).toBe(false);
  });

  it('canSendEventType falls through to events_default when type is unlisted', () => {
    const sm = makeSm({ userId: '@p:m' });
    sm.powerLevels = { users_default: 10, events_default: 5 };
    expect(canSendEventType(sm, EVENT_TYPES.TOKEN)).toBe(true);
  });

  it('canSendEventType falls through to state_default when both event maps are missing', () => {
    const sm = makeSm({ userId: '@p:m' });
    sm.powerLevels = { users_default: 0, state_default: 50 };
    expect(canSendEventType(sm, EVENT_TYPES.TOKEN)).toBe(false);
  });

  it('canSendEventType permits writes when no PL state has arrived (homeserver remains the gate)', () => {
    const sm = makeSm();
    expect(canSendEventType(sm, EVENT_TYPES.WALL)).toBe(true);
  });
});

