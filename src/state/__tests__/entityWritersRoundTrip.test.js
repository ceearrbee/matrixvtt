/**
 * Entity-writer round-trip - verifies the full path:
 *   writer call  →  yjs.<coll>Map.set  →  bridge subscription
 *                →  per-id signal      →  sm.<coll> mirror.
 *
 * Existing tests stop at the Y.Map spy (facadeWriters.test.js) or
 * mock Yjs entirely (entityWriters.test.js). This file constructs a
 * real StateManager with a real SubscriptionManager so
 * `stateManager-yjs-bridges.js` is exercised end-to-end. A bridge
 * regression that quietly stops mirroring into sm.X would flip
 * these tests red without touching the unit-level facade tests.
 *
 * Reuses the rig pattern established by demoData.test.js.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../StateManager.js';
import { SubscriptionManager } from '../../widget/SubscriptionManager.js';

function makeStateManager(userId = '@gm:m') {
  const widgetManager = {
    userId,
    roomId: '!demo:server',
    isStandalone: true,
    sendStateEvent: vi.fn().mockResolvedValue({}),
    getApi: () => null,
    init: vi.fn(),
  };
  const sm = new StateManager(widgetManager, new SubscriptionManager());
  // Mark this user as GM so writers that gate on isGM don't reject.
  sm.settings = { ...sm.settings, gm_user_ids: [userId] };
  return sm;
}

let sm;
beforeEach(() => { sm = makeStateManager(); });
afterEach(() => { sm.subscriptionManager?.destroy?.(); sm = null; });

// ─── Keyed-collection round-trips ───────────────────────────────────────────

const KEYED_CASES = [
  { coll: 'characters', update: 'updateCharacter', remove: 'removeCharacter', seed: { name: 'Aria' },    next: { name: 'Aria the Bold' } },
  { coll: 'npcs',       update: 'updateNPC',       remove: 'removeNPC',       seed: { name: 'Goblin' },  next: { name: 'Goblin King' } },
  { coll: 'items',      update: 'updateItem',      remove: 'removeItem',      seed: { name: 'Sword' },   next: { name: 'Sword +1' } },
  { coll: 'spells',     update: 'updateSpell',     remove: 'removeSpell',     seed: { name: 'Fireball' },next: { name: 'Fireball, Greater' } },
  { coll: 'handouts',   update: 'updateHandout',   remove: 'removeHandout',   seed: { title: 'Letter' }, next: { title: 'Letter (rev. 2)' } },
  { coll: 'tables',     update: 'updateTable',     remove: 'removeTable',     seed: { name: 'Loot' },    next: { name: 'Loot, Tier 2' } },
];

for (const c of KEYED_CASES) {
  describe(`${c.coll} round-trip`, () => {
    it(`${c.update}(id, value) populates sm.${c.coll}`, async () => {
      const value = { id: 'x-1', ...c.seed };
      await sm[c.update]('x-1', value);
      expect(sm[c.coll].get('x-1')).toEqual(value);
    });

    it(`${c.update}(id, newValue) replaces the previous mirror`, async () => {
      const first = { id: 'x-1', ...c.seed };
      await sm[c.update]('x-1', first);
      const second = { id: 'x-1', ...c.next };
      await sm[c.update]('x-1', second);
      expect(sm[c.coll].get('x-1')).toEqual(second);
    });

    it(`${c.remove}(id) removes the entry from sm.${c.coll}`, async () => {
      const value = { id: 'x-1', ...c.seed };
      await sm[c.update]('x-1', value);
      expect(sm[c.coll].has('x-1')).toBe(true);
      await sm[c.remove]('x-1');
      expect(sm[c.coll].has('x-1')).toBe(false);
    });
  });
}

// ─── Token-specific round-trips ─────────────────────────────────────────────

describe('tokens round-trip', () => {
  beforeEach(async () => {
    // Tokens need an active map for clamping. The maps collection
    // mirrors through the bridge; activeMapId is a signal-backed
    // setter that drives the `sm.map` getter.
    sm.maps.set('m1', { id: 'm1', width_cells: 10, height_cells: 10, cell_px: 50 });
    sm.activeMapId = 'm1';
  });

  it('updateToken populates sm.tokens', async () => {
    const tok = { id: 't1', col: 1, row: 2, size: 1 };
    await sm.updateToken('t1', tok);
    const round = sm.tokens.get('t1');
    expect(round).toBeTruthy();
    expect(round.col).toBe(1);
    expect(round.row).toBe(2);
  });

  it('updateToken clamps col/row inside the map and the mirror reflects the clamped value', async () => {
    await sm.updateToken('t1', { id: 't1', col: 99, row: -5, size: 1 });
    const round = sm.tokens.get('t1');
    expect(round.col).toBe(9);
    expect(round.row).toBe(0);
  });

  it('updateToken with a size-3 token clamps to leave room', async () => {
    await sm.updateToken('t1', { id: 't1', col: 9, row: 9, size: 3 });
    const round = sm.tokens.get('t1');
    expect(round.col).toBe(7);
    expect(round.row).toBe(7);
  });

  it('updateToken with {} removes the token from sm.tokens', async () => {
    await sm.updateToken('t1', { id: 't1', col: 0, row: 0, size: 1 });
    expect(sm.tokens.has('t1')).toBe(true);
    await sm.updateToken('t1', {});
    expect(sm.tokens.has('t1')).toBe(false);
  });

  it('deleteToken removes the token from sm.tokens', async () => {
    await sm.updateToken('t2', { id: 't2', col: 0, row: 0, size: 1 });
    expect(sm.tokens.has('t2')).toBe(true);
    await sm.deleteToken('t2');
    expect(sm.tokens.has('t2')).toBe(false);
  });
});
