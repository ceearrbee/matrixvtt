/**
 * Mode-driven default tab.
 *
 * When the user has not manually picked a sheet tab this session,
 * switching table phase (or GM prep) should retarget the default:
 *   - narrative, no prep → SHEET (Journal drawer covers handouts/pages on
 *     the left; the right rail complements with the character sheet)
 *   - combat → COMBAT tab
 *   - narrative, GM prep active → PARTY
 * Once the user manually switches a tab (via `switchTab`), the mode
 * effect must stop overriding their choice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TABS, UI_MODES } from '../utils/constants.js';
import { activeTabSignal, tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import {
  bindAutoTabToMode,
  unbindAutoTabFromMode,
  resetTabManuallyChosen,
} from '../ui/ui-mode.js';
import { switchTab } from '../ui/tab-navigation.js';

function makeUi(isGM) {
  return {
    state: { isGM: () => isGM },
    _currentTab: TABS.SHEET,
    switchTab(t) { switchTab(this, t); },
  };
}

describe('mode-driven default tab', () => {
  beforeEach(() => {
    activeTabSignal.value = TABS.SHEET;
    // Start in COMBAT so each test's switch into NARRATIVE actually
    // flips the signal and exercises the effect.
    tablePhaseSignal.value = UI_MODES.COMBAT;
    gmPrepActiveSignal.value = false;
    resetTabManuallyChosen();
  });
  afterEach(() => {
    unbindAutoTabFromMode();
  });

  it('switching to narrative phase defaults the tab to SHEET (Journal drawer covers Notes)', () => {
    activeTabSignal.value = TABS.ITEMS; // start somewhere other than SHEET so we can detect the change
    bindAutoTabToMode(makeUi(false));
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    expect(activeTabSignal.value).toBe(TABS.SHEET);
  });

  it('combat phase defaults the tab to COMBAT', () => {
    activeTabSignal.value = TABS.SHEET;
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    bindAutoTabToMode(makeUi(false));
    tablePhaseSignal.value = UI_MODES.COMBAT;
    expect(activeTabSignal.value).toBe(TABS.COMBAT);
  });

  it('GM activating prep defaults the tab to PARTY', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    bindAutoTabToMode(makeUi(true));
    gmPrepActiveSignal.value = true;
    expect(activeTabSignal.value).toBe(TABS.PARTY);
  });

  it('non-GM with prep flag does not get retargeted to the prep default', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    bindAutoTabToMode(makeUi(false));
    activeTabSignal.value = TABS.SHEET;
    gmPrepActiveSignal.value = true;
    expect(activeTabSignal.value).toBe(TABS.SHEET);
  });

  it('once the user manually switches a tab, mode changes do not override', () => {
    const ui = makeUi(false);
    bindAutoTabToMode(ui);
    ui.switchTab(TABS.ITEMS);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    expect(activeTabSignal.value).toBe(TABS.ITEMS);
  });
});
