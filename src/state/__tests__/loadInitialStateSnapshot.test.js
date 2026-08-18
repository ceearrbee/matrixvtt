/**
 * loadInitialState snapshot consumer (1.1b). When a room has published a
 * Yjs SNAPSHOT, joining clients must load it (so the bridges mirror state
 * into sm.tokens et al.) and skip the LWW bulk replay for types the
 * snapshot covers - otherwise stale legacy state would clobber the CRDT.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { loadInitialState } from '../syncer.js';
import { YjsManager, YJS_EVENT_TYPES } from '../YjsManager.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function snapshotWith(map, key, val) {
  const doc = new Y.Doc();
  doc.getMap(map).set(key, val);
  const update = Y.encodeStateAsUpdate(doc);
  return {
    type: YJS_EVENT_TYPES.SNAPSHOT,
    state_key: '',
    content: {
      data: btoa(String.fromCharCode(...update)),
      marker: Date.now(),
    },
  };
}

function makeSm(api) {
  const yjs = new YjsManager('!r:m');
  return {
    widgetManager: { userId: '@me:m', getApi: () => api },
    yjs,
    tokens: new Map(),
    characters: new Map(),
    npcs: new Map(),
    items: new Map(),
    spells: new Map(),
    handouts: new Map(),
    tables: new Map(),
    pins: new Map(),
    templates: new Map(),
    walls: new Map(),
    maps: new Map(),
    drawings: [],
    fog: { mode: 'hidden', revealed: [] },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    settings: { systemConfig: null },
    activeMapId: null,
    damageLog: [],
    lastSentState: new Map(),
    _cleaningUp: false,
    refreshing: false,
    sendStateEvent: vi.fn().mockResolvedValue({}),
    isGM: () => true,
    tombstoneForeignEvent: vi.fn(),
  };
}

describe('loadInitialState snapshot wiring', () => {
  it('loads the SNAPSHOT into YjsManager when one is present', async () => {
    const snap = snapshotWith('tokens', 't1', { id: 't1', sheet_id: 's1', col: 1, row: 2 });
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([snap]);
        return Promise.resolve([]);
      }),
    };
    const sm = makeSm(api);
    const loadSpy = vi.spyOn(sm.yjs, 'loadSnapshot');

    await loadInitialState(sm);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(sm.yjs.tokensMap.get('t1')).toEqual({ id: 't1', sheet_id: 's1', col: 1, row: 2 });
  });

  it('skips legacy LWW replay for Yjs-routed types when a snapshot is present', async () => {
    const snap = snapshotWith('tokens', 't-snapshot', { id: 't-snapshot', sheet_id: 's', col: 0, row: 0 });
    const legacyToken = {
      type: EVENT_TYPES.TOKEN,
      state_key: 't-legacy',
      content: { id: 't-legacy', sheet_id: 's', col: 9, row: 9 },
      event_id: '$legacy',
    };
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([snap]);
        if (type === EVENT_TYPES.TOKEN) return Promise.resolve([legacyToken]);
        return Promise.resolve([]);
      }),
    };
    const sm = makeSm(api);
    await loadInitialState(sm);

    // Snapshot token landed in Yjs.
    expect(sm.yjs.tokensMap.has('t-snapshot')).toBe(true);
    // Legacy bulk did NOT seed sm.tokens for the Yjs-routed type.
    expect(sm.tokens.has('t-legacy')).toBe(false);
  });

  it('is a no-op when no snapshot is present (no legacy bulk replay anymore)', async () => {
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
    };
    const sm = makeSm(api);
    await expect(loadInitialState(sm)).resolves.toBeUndefined();
    // Only power levels and the SNAPSHOT type are fetched.
    const types = api.receiveStateEvents.mock.calls.map((c) => c[0]);
    expect(types).toEqual([EVENT_TYPES.POWER_LEVELS, YJS_EVENT_TYPES.SNAPSHOT]);
  });

  it('does not throw on a corrupt snapshot payload', async () => {
    const corrupt = {
      type: YJS_EVENT_TYPES.SNAPSHOT,
      state_key: '',
      content: { data: 'not-base64-!!!', marker: Date.now() },
    };
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([corrupt]);
        return Promise.resolve([]);
      }),
    };
    const sm = makeSm(api);
    await expect(loadInitialState(sm)).resolves.toBeUndefined();
  });
});

// ─── Regression: clearAllCollections must not wipe the just-applied snapshot ──
//
// Bug: clearAllCollections ran AFTER applyYjsSnapshotIfPresent, so the
// mirror-into-ReactiveMap that the snapshot apply produced via the
// YjsSignalBridge was thrown away. With the legacy LWW replay skipped for
// Yjs-routed types, the user landed on an empty StateManager and the
// setup wizard fired on resume.
describe('loadInitialState - snapshot survives clearAllCollections', () => {
  it('mirrors snapshot tokens into a ReactiveMap-backed sm.tokens and they remain after the load', async () => {
    // Use a real StateManager so the YjsSignalBridge wiring is exercised
    // end to end - that's the path the bug traveled through.
    const { StateManager } = await import('../StateManager.js');
    const { SubscriptionManager } = await import('../../widget/SubscriptionManager.js');
    const { createMockWidgetManager } = await import('../../../tests/mocks/widgetManager.mock.js');

    const snap = snapshotWith('tokens', 't1', { id: 't1', sheet_id: 's1', col: 5, row: 6 });
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([snap]);
        return Promise.resolve([]);
      }),
      observeStateEvents: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };
    const wm = createMockWidgetManager({ isStandalone: true });
    wm.getApi = () => api;
    const sm = new StateManager(wm, new SubscriptionManager());

    await loadInitialState(sm);

    // The snapshot is still in the Yjs map…
    expect(sm.yjs.tokensMap.get('t1')).toMatchObject({ id: 't1' });
    // …AND mirrored into sm.tokens (this is the assertion that fails
    // pre-fix because clearAllCollections wiped it).
    expect(sm.tokens.size).toBe(1);
    expect(sm.tokens.get('t1')).toMatchObject({ id: 't1', col: 5, row: 6 });
  });

  it('mirrors snapshot maps into sm.maps so the wizard does not fire on resume', async () => {
    const { StateManager } = await import('../StateManager.js');
    const { SubscriptionManager } = await import('../../widget/SubscriptionManager.js');
    const { createMockWidgetManager } = await import('../../../tests/mocks/widgetManager.mock.js');

    const snap = snapshotWith('maps', 'm1', { id: 'm1', name: 'Tavern', width_cells: 20, height_cells: 20, cell_px: 40 });
    const api = {
      receiveStateEvents: vi.fn().mockImplementation((type) => {
        if (type === YJS_EVENT_TYPES.SNAPSHOT) return Promise.resolve([snap]);
        return Promise.resolve([]);
      }),
      observeStateEvents: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };
    const wm = createMockWidgetManager({ isStandalone: true });
    wm.getApi = () => api;
    const sm = new StateManager(wm, new SubscriptionManager());

    await loadInitialState(sm);

    expect(sm.maps.size).toBe(1);
    expect(sm.maps.get('m1')).toMatchObject({ name: 'Tavern' });
  });
});
