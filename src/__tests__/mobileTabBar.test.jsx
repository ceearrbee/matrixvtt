/**
 * MobileTabBar - phone bottom navigation. Switches `mobilePaneSignal`
 * between the four shell surfaces; the Panel tab's label tracks the
 * active phase and prep state (mirroring the right-rail content swap).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { MobileTabBar } from '../ui/MobileTabBar.jsx';
import { mobilePaneSignal, tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi(isGM = false) {
  return { state: { isGM: () => isGM } };
}

afterEach(() => {
  cleanup();
  mobilePaneSignal.value = 'chat';
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
});

describe('MobileTabBar', () => {
  it('renders the four panes and marks the active one', () => {
    mobilePaneSignal.value = 'chat';
    const { getByLabelText } = render(h(MobileTabBar, { ui: makeUi() }));
    expect(getByLabelText('Chat').getAttribute('aria-current')).toBe('page');
    expect(getByLabelText('Map').getAttribute('aria-current')).toBeNull();
    expect(getByLabelText('Journal')).toBeTruthy();
  });

  it('clicking a tab sets mobilePaneSignal', () => {
    const { getByLabelText } = render(h(MobileTabBar, { ui: makeUi() }));
    fireEvent.click(getByLabelText('Map'));
    expect(mobilePaneSignal.value).toBe('map');
  });

  it('Panel tab label tracks the phase and prep state', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    const combat = render(h(MobileTabBar, { ui: makeUi(true) }));
    expect(combat.getByLabelText('Combat')).toBeTruthy();
    cleanup();

    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    const prep = render(h(MobileTabBar, { ui: makeUi(true) }));
    expect(prep.getByLabelText('Prep')).toBeTruthy();
    cleanup();

    gmPrepActiveSignal.value = false;
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    const sheet = render(h(MobileTabBar, { ui: makeUi() }));
    expect(sheet.getByLabelText('Sheet')).toBeTruthy();
  });
});
