/**
 * Dev reset path (`window.__vttReset()` in src/app.js) depends on
 * several StateManager methods:
 *   - initBlankCampaign(name, system)
 *   - setCleaningUp(bool)
 *   - _clearAllState()   (also used by campaign-init.js)
 * And campaign-init must add to `sm.maps` + `sm.activeMapId`, never
 * assign to `sm.map` (a read-only getter). These tests lock in that
 * surface.
 */

import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../StateManager.js';
import { initBlankCampaign } from '../campaign-init.js';
import { createMockWidgetManager } from '../../../tests/mocks/widgetManager.mock.js';

vi.mock('../../widget/SubscriptionManager.js', () => ({
  SubscriptionManager: class {
    subscribe() {} unsubscribeAll() {} destroy() {}
  }
}));

function makeSubscriptionManager() {
  const subs = new Map();
  return {
    subscribe(name, source, fn) {
      subs.get(name)?.();
      const unsub = source.subscribe?.(fn) ?? (() => {});
      subs.set(name, unsub);
      return { unsubscribe: unsub };
    },
    destroy() { for (const u of subs.values()) u(); subs.clear(); },
  };
}

function makeSM() {
  const wm = createMockWidgetManager({ isStandalone: true });
  return new StateManager(wm, makeSubscriptionManager());
}

describe('StateManager dev-reset surface', () => {
  it('setCleaningUp toggles the internal flag', () => {
    const sm = makeSM();
    expect(sm._cleaningUp).toBe(false);
    sm.setCleaningUp(true);
    expect(sm._cleaningUp).toBe(true);
    sm.setCleaningUp(false);
    expect(sm._cleaningUp).toBe(false);
  });

  it('_clearAllState empties every entity collection', () => {
    const sm = makeSM();
    sm.tokens.set('a', { id: 'a' });
    sm.characters.set('b', { id: 'b' });
    sm.maps.set('m', { id: 'm' });
    sm.drawings.push({ id: 'd' });
    sm.roomMembers.push({ userId: '@x' });

    sm._clearAllState();

    expect(sm.tokens.size).toBe(0);
    expect(sm.characters.size).toBe(0);
    expect(sm.maps.size).toBe(0);
    expect(sm.drawings).toEqual([]);
    expect(sm.roomMembers).toEqual([]);
  });

  it('initBlankCampaign as a StateManager method seeds settings and a default map', () => {
    const sm = makeSM();
    sm.tokens.set('stale', { id: 'stale' });

    sm.initBlankCampaign('My Game', 'dnd5e');

    expect(sm.settings.name).toBe('My Game');
    expect(sm.settings.system).toBe('dnd5e');
    expect(sm.tokens.size).toBe(0);
    expect(sm.maps.size).toBe(1);
    expect(sm.activeMapId).not.toBeNull();
    const [map] = Array.from(sm.maps.values());
    expect(map.name).toBe('Empty Map');
  });
});

describe('campaign-init initBlankCampaign standalone function', () => {
  it('does not throw assigning to sm.map (uses sm.maps + activeMapId now)', () => {
    const sm = makeSM();
    expect(() => initBlankCampaign(sm, 'Blank', 'dnd5e')).not.toThrow();
    expect(sm.maps.size).toBe(1);
    expect(sm.activeMapId).toBeTruthy();
  });
});
