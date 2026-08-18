/**
 * Header structure - two zones (left / right). The table phase moved out
 * of the header (combat auto-layers over the always-present map+chat); the
 * subtitle is the single phase-status surface and Alt+P toggles GM prep.
 *
 *   __left:  mobile channels-drawer toggle + room title + subtitle
 *   __right: utility cluster + mobile sheet-drawer toggle
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { Header } from '../ui/Header.jsx';
import { settingsSignal, initiativeSignal, roomMembersSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi({ isGM = false } = {}) {
  return {
    state: {
      isGM: () => isGM,
      roomMembers: [],
      settings: { name: 'Test Room', systemConfig: {}, gm_user_ids: [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
    toggleTheme: () => {},
    openSettings: () => {},
  };
}

describe('Header structure', () => {
  beforeEach(() => {
    settingsSignal.value = { name: 'Test Room', systemConfig: {}, gm_user_ids: [] };
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    roomMembersSignal.value = [];
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
  });
  afterEach(cleanup);

  it('renders two zones: __left and __right, and no center', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('.vtt-header__left')).not.toBeNull();
    expect(container.querySelector('.vtt-header__right')).not.toBeNull();
    expect(container.querySelector('.vtt-header__center')).toBeNull();
    expect(container.querySelector('.phase-status')).toBeNull();
  });

  it('room title + subtitle sit in the left zone', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    const left = container.querySelector('.vtt-header__left');
    expect(left.querySelector('.vtt-header__title').textContent).toBe('Test Room');
    expect(left.querySelector('.vtt-header__subtitle')).not.toBeNull();
  });

  it('subtitle reads "No combat" at rest', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('.vtt-header__subtitle').textContent).toBe('No combat');
  });

  it('subtitle reads "Combat staged" when phase is combat with no active order', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('.vtt-header__subtitle').textContent).toBe('Combat staged');
  });

  it('subtitle shows round + actor (non-possessive) during active combat', () => {
    const ui = makeUi();
    ui.state.initiative = { active: true, round: 3, current_index: 0, order: [{ name: 'Aria' }] };
    initiativeSignal.value = ui.state.initiative;
    const { container } = render(h(Header, { ui }));
    expect(container.querySelector('.vtt-header__subtitle').textContent).toBe('Round 3 · Aria');
  });

  it('shows a GM "+ New" create button', () => {
    render(h(Header, { ui: makeUi({ isGM: true }) }));
    expect(document.getElementById('new-entity-btn')).not.toBeNull();
  });

  it('hides the "+ New" button from non-GMs', () => {
    render(h(Header, { ui: makeUi({ isGM: false }) }));
    expect(document.getElementById('new-entity-btn')).toBeNull();
  });

  it('renders the mobile drawer toggles when callbacks are provided', () => {
    const { container } = render(h(Header, {
      ui: makeUi(),
      onToggleChannels: () => {},
      onToggleSheet: () => {},
    }));
    expect(container.querySelector('.shell__mobile-toggle--channels')).not.toBeNull();
    expect(container.querySelector('.shell__mobile-toggle--sheet')).not.toBeNull();
  });

  it('omits the mobile toggles when no callbacks are provided', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('.shell__mobile-toggle')).toBeNull();
  });
});
