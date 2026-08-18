import { describe, it, expect } from 'vitest';
import { StateManager } from '../state/StateManager.js';

describe('StateManager.getGameSystemPresets (static)', () => {
  it('is exposed on the class so `ui.state.constructor.getGameSystemPresets()` works', () => {
    expect(typeof StateManager.getGameSystemPresets).toBe('function');
    const presets = StateManager.getGameSystemPresets();
    expect(presets).toBeTruthy();
    expect(presets.dnd5e).toBeTruthy();
    expect(Object.keys(presets).length).toBeGreaterThan(0);
  });

  it('is reachable via an instance\'s constructor (matches Settings.jsx call site)', () => {
    const widgetManager = { isStandalone: true };
    const subscriptionManager = { subscribe: () => ({ unsubscribe: () => {} }), destroy: () => {} };
    const sm = new StateManager(widgetManager, subscriptionManager);
    expect(() => sm.constructor.getGameSystemPresets()).not.toThrow();
    expect(sm.constructor.getGameSystemPresets().dnd5e).toBeTruthy();
  });
});
