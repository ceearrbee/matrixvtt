/**
 * §B2 / §B5 - pin the non-initiative effects in src/ui/state-effects.js
 * (settings + characters) and the disposer-cleanup contract honored by
 * destroyUI. The initiative effect is covered by initiativeAnnounceDedup.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsSignal, charactersSignal, initiativeSignal } from '../state/signals.js';
import { registerStateEffects } from '../ui/state-effects.js';

function makeUi() {
  return {
    state: {
      loaded: true,
      refreshing: false,
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      settings: { ruleset_slug: 'dnd5e' },
      tokens: new Map(),
      characters: new Map(),
      getCurrentCharacter: () => null,
    },
    _syncDisplayName: vi.fn(),
    _toast: vi.fn(),
    _log: vi.fn(),
    _announce: vi.fn(),
    _startTurnTimer: vi.fn(),
    _stopTurnTimer: vi.fn(),
    _isMyCombatTurn: () => false,
    switchTab: vi.fn(),
    mapRenderer: { panToToken: vi.fn(), scheduleCombatFrame: vi.fn(), cancelCombatFrame: vi.fn() },
  };
}

beforeEach(() => {
  settingsSignal.value = {};
  charactersSignal.value = new Map();
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
});

describe('settings effect', () => {
  it('triggers _syncDisplayName when settings change', () => {
    const ui = makeUi();
    registerStateEffects(ui);
    settingsSignal.value = { ruleset_slug: 'dnd5e' };
    expect(ui._syncDisplayName).toHaveBeenCalled();
  });

  it('toasts once when the loaded ruleset is missing from the registry', () => {
    const ui = makeUi();
    ui.state.settings = { _system_missing: 'ghost-system' };
    registerStateEffects(ui);
    settingsSignal.value = { _system_missing: 'ghost-system' };
    expect(ui._toast).toHaveBeenCalledTimes(1);
    expect(ui._toast.mock.calls[0][0]).toContain('ghost-system');
    expect(ui._toast.mock.calls[0][1]).toBe('error');

    settingsSignal.value = { _system_missing: 'ghost-system', other: true };
    expect(ui._toast).toHaveBeenCalledTimes(1);
  });

  it('does not toast when no ruleset is missing', () => {
    const ui = makeUi();
    registerStateEffects(ui);
    settingsSignal.value = { ruleset_slug: 'dnd5e' };
    expect(ui._toast).not.toHaveBeenCalled();
  });
});

describe('characters effect', () => {
  it('triggers _syncDisplayName when the characters map updates', () => {
    const ui = makeUi();
    registerStateEffects(ui);
    charactersSignal.value = new Map([['c1', { id: 'c1', name: 'Alice' }]]);
    expect(ui._syncDisplayName).toHaveBeenCalled();
  });

  it('skips the priming run so init-time signal reads do not fire side effects', () => {
    const ui = makeUi();
    // registerStateEffects subscribes synchronously and reads the current
    // signal value once; that read must not call _syncDisplayName.
    registerStateEffects(ui);
    expect(ui._syncDisplayName).not.toHaveBeenCalled();
  });
});

describe('initiative effect - stop-combat path', () => {
  it('stops the turn timer and cancels the combat frame on transition out of combat', () => {
    const ui = makeUi();
    registerStateEffects(ui);
    const order = [{ name: 'Aria' }];
    ui.state.initiative = { active: true, round: 1, current_index: 0, order };
    initiativeSignal.value = { ...ui.state.initiative };
    ui._stopTurnTimer.mockClear();
    ui.mapRenderer.cancelCombatFrame.mockClear();

    ui.state.initiative = { active: false, round: 1, current_index: 0, order: [] };
    initiativeSignal.value = { ...ui.state.initiative };
    expect(ui._stopTurnTimer).toHaveBeenCalledOnce();
    expect(ui.mapRenderer.cancelCombatFrame).toHaveBeenCalledOnce();
  });
});

describe('disposer cleanup (B5)', () => {
  it('returns a dispose() that detaches every effect', () => {
    const ui = makeUi();
    const dispose = registerStateEffects(ui);
    settingsSignal.value = { ruleset_slug: 'dnd5e' };
    expect(ui._syncDisplayName).toHaveBeenCalledTimes(1);

    dispose();
    settingsSignal.value = { ruleset_slug: 'fate' };
    charactersSignal.value = new Map([['c1', { id: 'c1', name: 'A' }]]);
    expect(ui._syncDisplayName).toHaveBeenCalledTimes(1);
  });
});
