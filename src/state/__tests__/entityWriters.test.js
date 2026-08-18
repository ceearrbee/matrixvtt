/**
 * Direct unit tests for state/writers/entity-writers.js. The TOKEN and
 * CHARACTER writers route through Yjs (post-1.1a); the others (NPC, ITEM,
 * SPELL, HANDOUT, TABLE) still write to Matrix LWW until 1.1b lands.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  updateToken,
  deleteToken,
  updateTokenPosition,
  updateCharacter,
  deleteCharacter,
  updateNPC,
} from '../writers/entity-writers.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function makeSm({ map = null, walls = new Map() } = {}) {
  return {
    map,
    walls,
    tokens: new Map(),
    characters: new Map(),
    npcs: new Map(),
    items: new Map(),
    spells: new Map(),
    yjs: {
      tokensMap:     { set: vi.fn(), delete: vi.fn() },
      charactersMap: { set: vi.fn(), delete: vi.fn() },
      npcsMap:       { set: vi.fn(), delete: vi.fn() },
      itemsMap:      { set: vi.fn(), delete: vi.fn() },
      spellsMap:     { set: vi.fn(), delete: vi.fn() },
      handoutsMap:   { set: vi.fn(), delete: vi.fn() },
      tablesMap:     { set: vi.fn(), delete: vi.fn() },
      // Sheet writers (characters + NPCs) batch the sheet write and
      // any token portrait propagation inside doc.transact() so the
      // Yjs bridge sees a coherent update. In unit tests the body
      // runs synchronously.
      doc:           { transact: (fn) => fn() },
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  };
}

describe('updateToken (Yjs-routed)', () => {
  it('deletes from yjs.tokensMap when token is {}', async () => {
    const sm = makeSm();
    await updateToken(sm, 't1', {});
    expect(sm.yjs.tokensMap.delete).toHaveBeenCalledWith('t1');
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('clamps col/row inside the map bounds before persisting', async () => {
    const sm = makeSm({ map: { width_cells: 10, height_cells: 10, cell_px: 50 } });
    await updateToken(sm, 't1', { col: 99, row: -3, size: 1 });
    const persisted = sm.yjs.tokensMap.set.mock.calls[0][1];
    expect(persisted.col).toBe(9);
    expect(persisted.row).toBe(0);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('accounts for token size when clamping', async () => {
    const sm = makeSm({ map: { width_cells: 10, height_cells: 10, cell_px: 50 } });
    await updateToken(sm, 't1', { col: 9, row: 9, size: 3 });
    const persisted = sm.yjs.tokensMap.set.mock.calls[0][1];
    expect(persisted.col).toBe(7);
    expect(persisted.row).toBe(7);
  });
});

describe('deleteToken', () => {
  it('is updateToken with {} and routes through Yjs', async () => {
    const sm = makeSm();
    await deleteToken(sm, 't1');
    expect(sm.yjs.tokensMap.delete).toHaveBeenCalledWith('t1');
  });
});

describe('updateTokenPosition (Yjs-routed)', () => {
  function smWithToken(token = {}, opts = {}) {
    const sm = makeSm({
      map: { width_cells: 10, height_cells: 10, cell_px: 50 },
      ...opts,
    });
    sm.tokens.set('t1', { col: 0, row: 0, size: 1, ...token });
    return sm;
  }

  it('throws when canMoveToken denies the move', async () => {
    const sm = smWithToken({}, {});
    sm.widgetManager = { canEditRoomState: () => false, userId: '@x:m' };
    sm.settings = { gm_user_ids: ['@gm:m'] };
    await expect(updateTokenPosition(sm, 't1', 5, 5)).rejects.toThrow('Denied');
  });

  it('throws when the move would cross a solid wall', async () => {
    const walls = new Map([['w1', {
      p1: { x: 100, y: 0 }, p2: { x: 100, y: 500 }, blocks_movement: true,
    }]]);
    const sm = smWithToken({ col: 0, row: 0 }, { walls });
    sm.widgetManager = { canEditRoomState: () => true, userId: '@gm:m' };
    sm.powerLevels = { users: { '@gm:m': 50 } };
    await expect(updateTokenPosition(sm, 't1', 5, 0)).rejects.toThrow('Blocked by wall');
  });

  it('writes through yjs.tokensMap when the move is allowed', async () => {
    const walls = new Map([['w1', {
      p1: { x: 100, y: 0 }, p2: { x: 100, y: 500 }, blocks_movement: false,
    }]]);
    const sm = smWithToken({ col: 0, row: 0 }, { walls });
    sm.widgetManager = { canEditRoomState: () => true, userId: '@gm:m' };
    sm.powerLevels = { users: { '@gm:m': 50 } };
    await expect(updateTokenPosition(sm, 't1', 5, 0)).resolves.toBeUndefined();
    expect(sm.yjs.tokensMap.set).toHaveBeenCalled();
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });
});

describe('per-collection upsert/remove factory', () => {
  it('updateCharacter routes through yjs.charactersMap (Yjs-migrated type)', async () => {
    const sm = makeSm();
    await updateCharacter(sm, 'c1', { name: 'Aria' });
    expect(sm.yjs.charactersMap.set).toHaveBeenCalledWith('c1', { name: 'Aria' });
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('deleteCharacter routes through yjs.charactersMap', async () => {
    const sm = makeSm();
    await deleteCharacter(sm, 'c1');
    expect(sm.yjs.charactersMap.delete).toHaveBeenCalledWith('c1');
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('updateNPC routes through yjs.npcsMap', async () => {
    const sm = makeSm();
    await updateNPC(sm, 'n1', { name: 'Goblin' });
    expect(sm.yjs.npcsMap.set).toHaveBeenCalledWith('n1', { name: 'Goblin' });
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });
});

describe('writers do not mutate the live mirror objects', () => {
  it('updateTokenPosition leaves the stored token untouched and writes a new object', async () => {
    const sm = makeSm({ map: { width_cells: 10, height_cells: 10, cell_px: 50 } });
    const stored = { col: 0, row: 0, size: 1 };
    sm.tokens.set('t1', stored);
    sm.widgetManager = { canEditRoomState: () => true, userId: '@gm:m' };
    sm.powerLevels = { users: { '@gm:m': 50 } };

    await updateTokenPosition(sm, 't1', 3, 4);

    expect(stored.col).toBe(0);
    expect(stored.row).toBe(0);
    const [, written] = sm.yjs.tokensMap.set.mock.calls[0];
    expect(written).not.toBe(stored);
    expect(written).toMatchObject({ col: 3, row: 4 });
  });
});
