/**
 * The initiative effect drives the turn signal.
 *
 * It already logged the turn and announced it politely. Now it also
 * marks the tab, so a player who has tabbed away or is reading chat on
 * a phone learns the table is waiting on them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initiativeSignal } from '../state/signals.js';
import { registerStateEffects } from '../ui/state-effects.js';
import { resetTabSignal } from '../ui/notify/tab-signal.js';

const BASE = 'MatrixVTT';

function makeUi(myTurn = () => false) {
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
    _isMyCombatTurn: myTurn,
    switchTab: vi.fn(),
    mapRenderer: { panToToken: vi.fn(), scheduleCombatFrame: vi.fn(), cancelCombatFrame: vi.fn() },
  };
}

const turn = (idx) => ({
  active: true, round: 1, current_index: idx,
  order: [{ name: 'Aria', token_id: 't1' }, { name: 'Brox', token_id: 't2' }],
});

beforeEach(() => {
  document.title = BASE;
  resetTabSignal();
  document.title = BASE;
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
});
afterEach(() => resetTabSignal());

describe('the tab marks my turn', () => {
  it('marks the tab when the turn becomes mine', () => {
    const ui = makeUi(() => true);
    registerStateEffects(ui);
    ui.state.initiative = turn(0);
    initiativeSignal.value = { ...ui.state.initiative };
    expect(document.title).toBe(`(Your turn) ${BASE}`);
  });

  it('leaves the tab alone on someone else’s turn', () => {
    const ui = makeUi(() => false);
    registerStateEffects(ui);
    ui.state.initiative = turn(0);
    initiativeSignal.value = { ...ui.state.initiative };
    expect(document.title).toBe(BASE);
  });

  it('clears the mark when the turn passes on', () => {
    let mine = true;
    const ui = makeUi(() => mine);
    registerStateEffects(ui);
    ui.state.initiative = turn(0);
    initiativeSignal.value = { ...ui.state.initiative };
    expect(document.title).toBe(`(Your turn) ${BASE}`);

    mine = false;
    ui.state.initiative = turn(1);
    initiativeSignal.value = { ...ui.state.initiative };
    expect(document.title).toBe(BASE);
  });

  it('clears the mark when combat ends', () => {
    const ui = makeUi(() => true);
    registerStateEffects(ui);
    ui.state.initiative = turn(0);
    initiativeSignal.value = { ...ui.state.initiative };
    ui.state.initiative = { active: false, round: 1, current_index: 0, order: [] };
    initiativeSignal.value = { ...ui.state.initiative };
    expect(document.title).toBe(BASE);
  });
});
