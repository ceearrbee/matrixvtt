/**
 * destroyUI must tear down every effect / listener registered by
 * `ui-mode.js`. Otherwise logout + re-login stacks subscriptions across
 * sessions - the prior user's auto-switch effect keeps reacting to
 * initiative flips after the new user logs in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hydratePhase,
  bindPhaseToInitiative,
  bindAutoTabToMode,
} from '../ui/ui-mode.js';
import { destroyUI } from '../ui/lifecycle-init.js';
import { tablePhaseSignal, activeTabSignal, tabManuallyChosenSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';
import { TABS, UI_MODES } from '../utils/constants.js';

function makeUi() {
  return {
    state: { isGM: () => true },
    widgetManager: { userId: '@u:m', roomId: '!r:m' },
    _currentTab: TABS.SHEET,
    _seenLogEventIds: new Set(),
  };
}

describe('destroyUI tears down ui-mode subscriptions', () => {
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    activeTabSignal.value = TABS.SHEET;
    tabManuallyChosenSignal.value = false;
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    localStorage.clear();
  });
  afterEach(() => { localStorage.clear(); });

  it('auto-tab effect stops firing after destroyUI', () => {
    const ui = makeUi();
    bindAutoTabToMode(ui);
    destroyUI(ui);
    // After teardown, flipping phase would have retargeted activeTab.
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    expect(activeTabSignal.value).toBe(TABS.SHEET);
  });

  it('auto-combat effect stops firing after destroyUI', () => {
    bindPhaseToInitiative('@u:m', '!r:m');
    destroyUI(makeUi());
    // Rising edge of initiative.active would have switched phase.
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });

  it('destroyUI does not throw when cleanup functions are absent', () => {
    hydratePhase('@u:m', '!r:m', false);
    expect(() => destroyUI(makeUi())).not.toThrow();
  });
});
