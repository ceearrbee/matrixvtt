/**
 * StateManager Unit Tests
 *
 * Tests handleStateEvent() routing, event deduplication, and change-detection cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../StateManager.js';
import { createMockWidgetManager } from '../../../tests/mocks/widgetManager.mock.js';
import { createMockStateEvent } from '../../../tests/mocks/widgetApi.mock.js';
import { EVENT_TYPES } from '../../utils/constants.js';

// Stub YjsManager
vi.mock('../YjsManager.js', () => ({
  YjsManager: class {
    constructor() {
      const bridgeStub = () => ({ ids: { subscribe: vi.fn() }, get: vi.fn(() => null) });
      this.tokens = bridgeStub();
      this.characters = bridgeStub();
      this.npcs = bridgeStub();
      this.items = bridgeStub();
      this.spells = bridgeStub();
      this.handouts = bridgeStub();
      this.tables = bridgeStub();
      this.walls = bridgeStub();
      this.pins = bridgeStub();
      this.templates = bridgeStub();
      this.maps = bridgeStub();
      this.fog = bridgeStub();
      this.initiative = bridgeStub();
      this.settings = bridgeStub();
      this.drawings = bridgeStub();
      // Y.Map handles used by writers and persistence.
      const ymapStub = () => ({ set: vi.fn(), delete: vi.fn(), clear: vi.fn(), has: vi.fn(() => false) });
      this.tokensMap = ymapStub();
      this.charactersMap = ymapStub();
      this.npcsMap = ymapStub();
      this.itemsMap = ymapStub();
      this.spellsMap = ymapStub();
      this.handoutsMap = ymapStub();
      this.tablesMap = ymapStub();
      this.wallsMap = ymapStub();
      this.pinsMap = ymapStub();
      this.templatesMap = ymapStub();
      this.mapsMap = ymapStub();
      this.fogMap = ymapStub();
      this.initiativeMap = ymapStub();
      this.settingsMap = ymapStub();
      this.drawingsArray = { push: vi.fn(), delete: vi.fn(), length: 0, doc: { transact: (fn) => fn() } };
    }
    destroy() {}
    getStateVector() { return new Uint8Array(); }
    onUpdate() {}
    onDivergence() {}
  },
  YJS_EVENT_TYPES: { UPDATE: 'u', SNAPSHOT: 's', SYNC_VECTOR: 'v' },
}));

// StateManager imports SubscriptionManager - stub it so tests don't need RxJS
vi.mock('../../widget/SubscriptionManager.js', () => ({
  SubscriptionManager: class {
    constructor() { this.subscriptions = new Map(); }
    subscribe() {}
    unsubscribeAll() {}
    destroy() {}
  }
}));

// Stub validateStateEvent to pass through (validation has its own tests)
vi.mock('../../utils/schemas.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    validateStateEvent: vi.fn(),
    stateEventsEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
  };
});

vi.mock('../../utils/errorHandling.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withErrorHandling: vi.fn(),
  };
});

function makeStateManager(overrides = {}) {
  const wm = createMockWidgetManager({ isStandalone: true, ...overrides });
  return new StateManager(wm);
}

// ─────────────────────────────────────────────
// handleStateEvent – routing
// ─────────────────────────────────────────────

describe('handleStateEvent – routing', () => {
  // VTT entity state rides on Yjs; handleStateEvent only routes
  // POWER_LEVELS now. The Yjs-routed types never reach this handler.

  it('routes POWER_LEVELS into sm.powerLevels', () => {
    const sm = makeStateManager();
    sm.handleStateEvent(
      createMockStateEvent(EVENT_TYPES.POWER_LEVELS, { users_default: 0, users: { '@gm:m': 50 } })
    );
    expect(sm.powerLevels).toEqual({ users_default: 0, users: { '@gm:m': 50 } });
  });
});

// ─────────────────────────────────────────────
// sendStateEvent – change detection cache
// ─────────────────────────────────────────────

describe('sendStateEvent – change detection', () => {
  let sm, wm;
  beforeEach(() => {
    wm = createMockWidgetManager({ isStandalone: false });
    sm = new StateManager(wm);
  });

  it('skips send when content is identical to last sent', async () => {
    const content = { name: 'S', gm_user_ids: [], grid_px: 40 };
    await sm.sendStateEvent(EVENT_TYPES.SETTINGS, '', content);
    await sm.sendStateEvent(EVENT_TYPES.SETTINGS, '', { ...content });
    expect(wm.sendStateEvent).toHaveBeenCalledTimes(1);
  });

  it('sends again when content changes', async () => {
    const content = { name: 'S' };
    await sm.sendStateEvent(EVENT_TYPES.SETTINGS, '', content);
    await sm.sendStateEvent(EVENT_TYPES.SETTINGS, '', { name: 'Changed' });
    expect(wm.sendStateEvent).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────
// debouncedSend
// ─────────────────────────────────────────────

describe('StateManager.debouncedSend', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('writes to the matching Yjs Y.Map once after the delay', async () => {
    const sm = makeStateManager();
    sm.debouncedSend(EVENT_TYPES.CHARACTER, 'char-1', { hp: 5 });

    await vi.runAllTimersAsync();

    expect(sm.yjs.charactersMap.set).toHaveBeenCalledWith('char-1', { hp: 5 });
  });

  it('collapses rapid calls to the same key', async () => {
    const sm = makeStateManager();
    sm.debouncedSend(EVENT_TYPES.CHARACTER, 'char-1', { hp: 1 });
    sm.debouncedSend(EVENT_TYPES.CHARACTER, 'char-1', { hp: 2 });

    await vi.runAllTimersAsync();

    expect(sm.yjs.charactersMap.set).toHaveBeenCalledTimes(1);
    expect(sm.yjs.charactersMap.set).toHaveBeenCalledWith('char-1', { hp: 2 });
  });
});

// ─────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────

describe('StateManager permissions', () => {
  it('isGM follows power level, not gm_user_ids', () => {
    const sm = makeStateManager({ userId: '@gm:s' });
    sm.powerLevels = { users: { '@gm:s': 50 } };
    expect(sm.isGM()).toBe(true);

    sm.powerLevels = { users: {} };
    sm.settings.gm_user_ids = ['@gm:s'];
    expect(sm.isGM()).toBe(false);
  });

  it('canMoveToken allows GMs and owners', () => {
    const sm = makeStateManager({ userId: '@player:s' });
    sm.tokens.set('t1', { id: 't1', owner_user_id: '@player:s' });
    expect(sm.canMoveToken('t1')).toBe(true);

    sm.tokens.get('t1').owner_user_id = '@other:s';
    expect(sm.canMoveToken('t1')).toBe(false);

    sm.powerLevels = { users: { '@player:s': 50 } };
    expect(sm.canMoveToken('t1')).toBe(true);
  });
});
