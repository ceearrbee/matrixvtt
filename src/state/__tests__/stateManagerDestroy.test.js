/**
 * StateManager.destroy() must call the SubscriptionManager's real cleanup
 * method. Previously called the non-existent `unsubscribeAll()`, crashing
 * session start because app-client.js runs destroy() at the top of initVTT
 * to tear down any previous session.
 */

import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../StateManager.js';
import { createMockWidgetManager } from '../../../tests/mocks/widgetManager.mock.js';

describe('StateManager.destroy', () => {
  it('calls subscriptionManager.destroy (not unsubscribeAll)', () => {
    const wm = createMockWidgetManager({ isStandalone: true });
    const sub = {
      destroy: vi.fn(),
      subscribe: vi.fn(),
    };
    const sm = new StateManager(wm, sub);

    expect(() => sm.destroy()).not.toThrow();
    expect(sub.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('StateManager bulk-load reset (clearAllCollections regression lock)', () => {
  // clearAll/destroy must enumerate every collection on the object.
  // Pin the contract so a newly added collection
  // (e.g. a future entity type) doesn't silently leak across reloads.
  it('loadInitialState empties every Map collection, every array, and every pointer', async () => {
    const wm = createMockWidgetManager({ isStandalone: true });
    const sub = { destroy: vi.fn(), subscribe: vi.fn() };
    wm.getApi = () => ({ receiveStateEvents: vi.fn().mockResolvedValue([]) });
    const sm = new StateManager(wm, sub);

    // Populate every collection so clearAllCollections has something to clear.
    for (const field of ['tokens', 'characters', 'npcs', 'items', 'spells',
                         'handouts', 'tables', 'pins', 'templates', 'walls', 'maps']) {
      sm[field].set('seed', { id: 'seed' });
    }
    sm.drawings = [{ id: 'd1', strokes: [] }];
    sm.roomMembers = [{ userId: '@x:m' }];
    sm.damageLog = [{ delta: -1 }];
    sm.activeMapId = 'stale-map';

    await sm.loadInitialState();

    for (const field of ['tokens', 'characters', 'npcs', 'items', 'spells',
                         'handouts', 'tables', 'pins', 'templates', 'walls', 'maps']) {
      expect(sm[field].size, `sm.${field} not cleared`).toBe(0);
    }
    expect(sm.drawings).toEqual([]);
    expect(sm.roomMembers).toEqual([]);
    expect(sm.damageLog).toEqual([]);
    expect(sm.activeMapId).toBeNull();
  });
});
