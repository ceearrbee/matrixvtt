/**
 * Updating a character or NPC's image_url must cascade to every token
 * whose sheet_id binds to that sheet. Without this, the picker on the
 * sheet form looks like it worked (header updates) but the placed
 * token on the canvas keeps the stale URL - the exact user-reported
 * symptom that motivated this test.
 *
 * The render side (`src/map/layers/tokens.js`) reads `token.image_url`,
 * not `sheet.image_url`, so the propagation has to happen at write
 * time. All assertions go through the public StateManager facade so
 * the test survives a refactor of the writer internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../StateManager.js';
import { SubscriptionManager } from '../../widget/SubscriptionManager.js';
import { ENTITY_TYPES } from '../../utils/constants.js';

function makeStateManager(userId = '@gm:m') {
  const widgetManager = {
    userId,
    roomId: '!t:srv',
    isStandalone: true,
    sendStateEvent: vi.fn().mockResolvedValue({}),
    getApi: () => null,
    init: vi.fn(),
  };
  return new StateManager(widgetManager, new SubscriptionManager());
}

async function seed(sm, { sheets = [], npcs = [], tokens = [] } = {}) {
  sm.yjs.doc.transact(() => {
    for (const c of sheets) sm.yjs.charactersMap.set(c.id, c);
    for (const n of npcs) sm.yjs.npcsMap.set(n.id, n);
    for (const t of tokens) sm.yjs.tokensMap.set(t.id, t);
  });
}

describe('sheet → token image_url propagation', () => {
  let storage;
  beforeEach(() => {
    storage = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (k in storage ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
      },
    });
  });
  afterEach(() => { delete globalThis.localStorage; });

  it('updating a character image_url updates the bound token', async () => {
    const sm = makeStateManager();
    await seed(sm, {
      sheets: [{ id: 'chr-1', name: 'Aria', type: ENTITY_TYPES.PC, hp_max: 30, image_url: '/old.svg' }],
      tokens: [{
        id: 'tok-1', name: 'Aria', type: ENTITY_TYPES.PC, sheet_id: 'chr-1',
        col: 0, row: 0, hp_max: 30, hp_current: 30, ac: 14, image_url: '/old.svg',
      }],
    });

    await sm.updateCharacter('chr-1', {
      ...sm.characters.get('chr-1'),
      image_url: '/matrixvtt/icons/dark/lorc/broadsword.svg',
    });

    expect(sm.tokens.get('tok-1').image_url).toBe('/matrixvtt/icons/dark/lorc/broadsword.svg');
  });

  it('clearing an NPC image_url to null clears every bound token', async () => {
    const sm = makeStateManager();
    await seed(sm, {
      npcs: [{
        id: 'npc-orc', name: 'Orc', type: ENTITY_TYPES.NPC, hp_max: 11, ac: 13,
        image_url: '/orc.svg',
      }],
      tokens: [
        { id: 'tok-a', name: 'Orc A', type: ENTITY_TYPES.NPC, sheet_id: 'npc-orc', col: 0, row: 0, hp_max: 11, hp_current: 11, ac: 13, image_url: '/orc.svg' },
        { id: 'tok-b', name: 'Orc B', type: ENTITY_TYPES.NPC, sheet_id: 'npc-orc', col: 1, row: 0, hp_max: 11, hp_current: 11, ac: 13, image_url: '/orc.svg' },
      ],
    });

    await sm.updateNPC('npc-orc', {
      ...sm.npcs.get('npc-orc'),
      image_url: null,
    });

    expect(sm.tokens.get('tok-a').image_url).toBeNull();
    expect(sm.tokens.get('tok-b').image_url).toBeNull();
  });

  it('does not touch tokens bound to other sheets', async () => {
    const sm = makeStateManager();
    await seed(sm, {
      npcs: [
        { id: 'npc-1', name: 'Orc', type: ENTITY_TYPES.NPC, hp_max: 11, ac: 13, image_url: '/old.svg' },
        { id: 'npc-2', name: 'Goblin', type: ENTITY_TYPES.NPC, hp_max: 7, ac: 13, image_url: '/gob.svg' },
      ],
      tokens: [
        { id: 'tok-1', name: 'Orc', type: ENTITY_TYPES.NPC, sheet_id: 'npc-1', col: 0, row: 0, hp_max: 11, hp_current: 11, ac: 13, image_url: '/old.svg' },
        { id: 'tok-2', name: 'Goblin', type: ENTITY_TYPES.NPC, sheet_id: 'npc-2', col: 1, row: 0, hp_max: 7, hp_current: 7, ac: 13, image_url: '/gob.svg' },
      ],
    });

    await sm.updateNPC('npc-1', {
      ...sm.npcs.get('npc-1'),
      image_url: '/new.svg',
    });

    expect(sm.tokens.get('tok-1').image_url).toBe('/new.svg');
    // The token bound to a different sheet must remain untouched.
    expect(sm.tokens.get('tok-2').image_url).toBe('/gob.svg');
  });

  it('is a no-op when token.image_url already matches sheet.image_url', async () => {
    const sm = makeStateManager();
    const url = '/matrixvtt/icons/dark/lorc/dragon-head.svg';
    await seed(sm, {
      npcs: [{ id: 'npc-dragon', name: 'Dragon', type: ENTITY_TYPES.NPC, hp_max: 100, ac: 22, image_url: url }],
      tokens: [{ id: 'tok-dragon', name: 'Dragon', type: ENTITY_TYPES.NPC, sheet_id: 'npc-dragon', col: 0, row: 0, hp_max: 100, hp_current: 100, ac: 22, image_url: url }],
    });

    const tokenBefore = sm.tokens.get('tok-dragon');
    await sm.updateNPC('npc-dragon', {
      ...sm.npcs.get('npc-dragon'),
      // Identical image_url. Other field changes intentionally to
      // prove we still touched the sheet - just not the bound token.
      hp_max: 200,
      image_url: url,
    });
    const tokenAfter = sm.tokens.get('tok-dragon');

    expect(tokenAfter.image_url).toBe(url);
    // Token object identity stays - the propagation early-outs when
    // the URL hasn't changed, so we don't churn the Yjs entry.
    expect(tokenAfter).toBe(tokenBefore);
    expect(sm.npcs.get('npc-dragon').hp_max).toBe(200);
  });

  it('propagation also fires when the sheet had no image_url and gains one', async () => {
    const sm = makeStateManager();
    await seed(sm, {
      sheets: [{ id: 'chr-1', name: 'Aria', type: ENTITY_TYPES.PC, hp_max: 30 }],
      tokens: [{ id: 'tok-1', name: 'Aria', type: ENTITY_TYPES.PC, sheet_id: 'chr-1', col: 0, row: 0, hp_max: 30, hp_current: 30, ac: 14 }],
    });

    await sm.updateCharacter('chr-1', {
      ...sm.characters.get('chr-1'),
      image_url: '/matrixvtt/icons/dark/darkzaitzev/hooded-figure.svg',
    });

    expect(sm.tokens.get('tok-1').image_url).toBe('/matrixvtt/icons/dark/darkzaitzev/hooded-figure.svg');
  });
});
