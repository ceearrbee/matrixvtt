import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteSession } from '../ui/gm/session-ops.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));

function seedLocalCollections(state) {
  for (let i = 0; i < 8; i++) state.tokens.set(`tok${i}`,   { id: `tok${i}` });
  for (let i = 0; i < 6; i++) state.characters.set(`char${i}`, { id: `char${i}` });
  for (let i = 0; i < 3; i++) state.maps.set(`map${i}`,    { id: `map${i}` });
  // 17 keyed entities; SETTINGS is a singleton at key '' and is not tombstoned.
}

function makeUI({ failureCount = 0 } = {}) {
  const sent = [];
  let callNum = 0;
  const retryQueue = new Map();
  const lastSentState = new Map();

  const widgetManager = {
    isAppClient: true,
    isStandalone: false,
    sendStateEvent: vi.fn(async (type, id, content) => {
      callNum += 1;
      sent.push({ type, id, content, n: callNum });
      if (callNum <= failureCount) {
        const err = new Error('rate limited');
        err.status = 429;
        throw err;
      }
      return { ok: true };
    }),
    getRateLimitWait: () => 0,
  };

  const state = {
    isGM: () => true,
    _retryQueue: retryQueue,
    lastSentState,
    widgetManager,
    notifyUpdate: vi.fn(),
    tokens: new Map(), characters: new Map(), npcs: new Map(), items: new Map(),
    spells: new Map(), handouts: new Map(), tables: new Map(), maps: new Map(),
    sendStateEvent: vi.fn(async (type, stateKey, content) => {
      const { sendStateEvent: impl } = await import('../state/queue.js');
      return impl(state, type, stateKey, content);
    }),
    awaitQueueDrain: vi.fn(async (timeoutMs) => {
      const { awaitQueueDrain } = await import('../state/queue.js');
      return awaitQueueDrain(state, timeoutMs);
    }),
    settings: {},
    activeMapId: null,
  };
  seedLocalCollections(state);
  // Facade shims so _tombstoneOnce can dispatch via the per-type writers.
  state.updateToken = (id, v) => state.sendStateEvent(EVENT_TYPES.TOKEN, id, v);
  state.removeCharacter = (id) => state.sendStateEvent(EVENT_TYPES.CHARACTER, id, {});
  state.removeNPC = (id) => state.sendStateEvent(EVENT_TYPES.NPC, id, {});
  state.removeItem = (id) => state.sendStateEvent(EVENT_TYPES.ITEM, id, {});
  state.removeSpell = (id) => state.sendStateEvent(EVENT_TYPES.SPELL, id, {});
  state.removeHandout = (id) => state.sendStateEvent(EVENT_TYPES.HANDOUT, id, {});
  state.removeTable = (id) => state.sendStateEvent(EVENT_TYPES.TABLE, id, {});
  state.deleteMap = (id) => state.sendStateEvent(EVENT_TYPES.MAP, id, {});
  state._clearAllState = () => {
    for (const k of ['tokens', 'characters', 'npcs', 'items', 'spells', 'handouts', 'tables', 'maps']) state[k].clear();
  };

  return {
    state,
    widgetManager,
    _toast: vi.fn(),
    _renderApiStatusContent: () => '',
    sent,
  };
}

describe('deleteSession (§5 regression - 429 recovery)', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('eventually writes tombstones for every target even when the first burst 429s', async () => {
    const ui = makeUI({ failureCount: 5 });
    const dispatched = [];
    const origDispatch = window.dispatchEvent;
    window.dispatchEvent = (e) => { dispatched.push(e.type); return origDispatch.call(window, e); };

    try {
      await deleteSession(ui);
    } finally {
      window.dispatchEvent = origDispatch;
    }

    // Every keyed VTT entity (17 total) must be tombstoned with {} content -
    // the 429'd ones via the retry queue drain.
    const tombstoned = ui.sent.filter(e => e.content && Object.keys(e.content).length === 0);
    const uniqueKeys = new Set(tombstoned.map(e => `${e.type}:${e.id}`));
    expect(uniqueKeys.size).toBe(17);

    // DELETE_SESSION fires after all tombstones have landed.
    expect(dispatched).toContain(VTT_EVENTS.DELETE_SESSION);
  }, 20000);
});
