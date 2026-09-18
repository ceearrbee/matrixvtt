/**
 * The gate `stateManager-clear.js`'s own docblock promises.
 *
 * That file says `clearAllState` MUST enumerate every collection on the
 * StateManager, and names this test as the thing that pins it. The test
 * did not exist, and four things had drifted off the list:
 *
 *   - `damageLog`, room content, so the old campaign's hits stayed in
 *     the panel;
 *   - `_drawingHistory` / `_drawingFuture`, the drawing undo stacks -
 *     the worst of them, because undo WRITES: after "New Campaign" the
 *     GM pressing Ctrl+Z pushed the previous campaign's drawings back
 *     into the wiped room;
 *   - `_debounceTimers`, so a queued state write could land after the
 *     wipe and re-create what had just been deleted.
 *
 * `destroy()` cancels the timers, but the two paths that matter here -
 * `initBlankCampaign` and the delete-campaign flow - clear state and
 * keep the StateManager alive, so `destroy()` never runs.
 *
 * Rather than list the four, this walks the instance: after a clear,
 * nothing it holds may still carry anything.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { clearAllState } from '../state/stateManager-clear.js';
import { StateManager } from '../state/StateManager.js';

function makeStateManager() {
  const sm = new StateManager(/** @type {any} */ ({
    userId: '@me:hs', roomId: '!r:hs',
    sendStateEvent: vi.fn().mockResolvedValue({}),
    onEvent: vi.fn(), getRoomMembers: vi.fn().mockResolvedValue([]),
  }), /** @type {any} */ ({ subscribe: vi.fn(), destroy: vi.fn() }));
  const doc = new Y.Doc();
  sm.yjs = /** @type {any} */ ({
    doc,
    tokensMap: doc.getMap('t'), charactersMap: doc.getMap('c'), npcsMap: doc.getMap('n'),
    itemsMap: doc.getMap('i'), spellsMap: doc.getMap('s'), handoutsMap: doc.getMap('h'),
    tablesMap: doc.getMap('ta'), pinsMap: doc.getMap('p'), templatesMap: doc.getMap('te'),
    wallsMap: doc.getMap('w'), lightsMap: doc.getMap('l'), mapsMap: doc.getMap('m'),
    pagesMap: doc.getMap('pa'), fogMap: doc.getMap('f'), initiativeMap: doc.getMap('in'),
    settingsMap: doc.getMap('se'), drawingsArray: doc.getArray('d'),
  });
  return sm;
}

/** Put something in every Map and every array the instance owns. */
function fillEverything(sm) {
  for (const [key, value] of Object.entries(sm)) {
    if (value instanceof Map) value.set('leftover', { id: 'leftover' });
    else if (Array.isArray(value)) sm[key] = ['leftover'];
  }
}

function stillHolding(sm) {
  return Object.entries(sm)
    .filter(([, v]) => (v instanceof Map && v.size > 0) || (Array.isArray(v) && v.length > 0))
    .map(([k]) => k);
}

describe('clearAllState enumerates every collection', () => {
  let sm;
  beforeEach(() => { sm = makeStateManager(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('leaves nothing behind that the instance holds', () => {
    fillEverything(sm);
    expect(stillHolding(sm).length).toBeGreaterThan(0);
    clearAllState(sm);
    expect(stillHolding(sm)).toEqual([]);
  });

  it('leaves nothing behind when the Yjs doc is wiped too', () => {
    fillEverything(sm);
    clearAllState(sm, { clearYjs: true });
    expect(stillHolding(sm)).toEqual([]);
  });

  it('drops the drawing undo stack, so undo cannot write the old campaign back', () => {
    sm._drawingHistory = [JSON.stringify([{ id: 'old-stroke' }])];
    sm._drawingFuture = [JSON.stringify([{ id: 'old-redo' }])];
    clearAllState(sm, { clearYjs: true });
    expect(sm._drawingHistory).toEqual([]);
    expect(sm._drawingFuture).toEqual([]);
  });

  it('cancels queued writes so none can land after the wipe', () => {
    vi.useFakeTimers();
    const landed = vi.fn();
    sm._debounceTimers.set('tokens', setTimeout(landed, 500));
    clearAllState(sm, { clearYjs: true });
    vi.advanceTimersByTime(1000);
    expect(landed).not.toHaveBeenCalled();
    expect(sm._debounceTimers.size).toBe(0);
    vi.useRealTimers();
  });

  it('drops the damage log, which is one campaign\'s history', () => {
    sm.damageLog = [{ tokenId: 't1', amount: 7 }];
    clearAllState(sm);
    expect(sm.damageLog).toEqual([]);
  });
});
