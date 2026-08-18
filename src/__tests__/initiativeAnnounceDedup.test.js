/**
 * The combat-turn announcer must not re-fire when the homeserver
 * redelivers an identical initiative event (e.g. after a sync
 * reconnect). It announces only on actual turn changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initiativeSignal } from '../state/signals.js';
import { registerStateEffects } from '../ui/state-effects.js';

function makeUi() {
  return {
    state: {
      loaded: true,
      refreshing: false,
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      settings: { systemConfig: null, ruleset_slug: 'dnd5e' },
      tokens: new Map(),
      characters: new Map(),
      getCurrentCharacter: () => null,
    },
    _debugMode: false,
    _updateDebugBar: vi.fn(),
    _syncDisplayName: vi.fn(),
    _log: vi.fn(),
    _announce: vi.fn(),
    _startTurnTimer: vi.fn(),
    _stopTurnTimer: vi.fn(),
    _isMyCombatTurn: () => false,
    switchTab: vi.fn(),
    mapRenderer: { panToToken: vi.fn(), scheduleCombatFrame: vi.fn(), cancelCombatFrame: vi.fn() },
  };
}

describe('initiative announcer dedup', () => {
  let ui;
  beforeEach(() => {
    ui = makeUi();
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    registerStateEffects(ui);
  });

  it('announces once when a new turn begins', () => {
    ui.state.initiative = { active: true, round: 1, current_index: 0, order: [{ name: 'Aria', token_id: 't1' }] };
    initiativeSignal.value = { ...ui.state.initiative };
    expect(ui._log).toHaveBeenCalledTimes(1);
    expect(ui._log.mock.calls[0][1]).toContain('Round 1');
    expect(ui._announce).toHaveBeenCalledTimes(1);
  });

  it('does not re-announce when the same initiative state arrives again', () => {
    const init = { active: true, round: 1, current_index: 0, order: [{ name: 'Aria', token_id: 't1' }] };
    ui.state.initiative = init;
    initiativeSignal.value = { ...init };
    expect(ui._log).toHaveBeenCalledTimes(1);
    // Re-deliver identical content
    initiativeSignal.value = { ...init };
    expect(ui._log).toHaveBeenCalledTimes(1);
    expect(ui._announce).toHaveBeenCalledTimes(1);
  });

  it('announces again when current_index advances', () => {
    const order = [{ name: 'Aria' }, { name: 'Kael' }];
    ui.state.initiative = { active: true, round: 1, current_index: 0, order };
    initiativeSignal.value = { ...ui.state.initiative };
    ui.state.initiative = { active: true, round: 1, current_index: 1, order };
    initiativeSignal.value = { ...ui.state.initiative };
    expect(ui._log).toHaveBeenCalledTimes(2);
    expect(ui._log.mock.calls[1][1]).toContain('Kael');
  });

  it('announces again when the round increments', () => {
    const order = [{ name: 'Aria' }];
    ui.state.initiative = { active: true, round: 1, current_index: 0, order };
    initiativeSignal.value = { ...ui.state.initiative };
    ui.state.initiative = { active: true, round: 2, current_index: 0, order };
    initiativeSignal.value = { ...ui.state.initiative };
    expect(ui._log).toHaveBeenCalledTimes(2);
  });
});

describe('combat tab - no auto-switch on turn transition', () => {
  it('never calls ui.switchTab when the player\'s turn comes up', () => {
    // The previous behaviour yanked the user to the Combat tab the
    // moment their turn started - same side-effect-in-helper pattern
    // as the `ui._log` switchTab we removed. The toast already says
    // "it's your turn"; the tab switch was disruptive.
    const ui = makeUi();
    let myTurn = false;
    ui._isMyCombatTurn = () => myTurn;
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    registerStateEffects(ui);

    const order = [{ name: 'Aria' }];
    ui.state.initiative = { active: true, round: 1, current_index: 0, order };
    initiativeSignal.value = { ...ui.state.initiative };
    myTurn = true;
    ui.state.initiative = { active: true, round: 1, current_index: 1, order };
    initiativeSignal.value = { ...ui.state.initiative };

    expect(ui.switchTab).not.toHaveBeenCalled();
  });
});
