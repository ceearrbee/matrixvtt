/**
 * The header carries the only control for the GM Prep axis. Header.jsx
 * documented "Alt+P toggles the GM prep workspace" for months with no
 * binding and no button behind it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { Header } from '../ui/Header.jsx';
import { settingsSignal, initiativeSignal, roomMembersSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';

function makeUi({ isGM = true } = {}) {
  return {
    state: {
      isGM: () => isGM,
      roomMembers: [],
      settings: { name: 'Test Room', systemConfig: {}, gm_user_ids: [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
  };
}

describe('header GM prep toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    settingsSignal.value = { name: 'Test Room', systemConfig: {}, gm_user_ids: [] };
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    roomMembersSignal.value = [];
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
  });
  afterEach(cleanup);

  it('renders a Prep toggle for a GM', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    const btn = container.querySelector('#gm-prep-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('names Alt+P in the tooltip so the binding is discoverable', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    expect(container.querySelector('#gm-prep-btn').getAttribute('title')).toMatch(/Alt\+P/);
  });

  it('does not render the toggle for a player', () => {
    const { container } = render(h(Header, { ui: makeUi({ isGM: false }) }));
    expect(container.querySelector('#gm-prep-btn')).toBeNull();
  });

  it('clicking it turns the prep workspace on and off', () => {
    const { container } = render(h(Header, { ui: makeUi() }));
    fireEvent.click(container.querySelector('#gm-prep-btn'));
    expect(gmPrepActiveSignal.value).toBe(true);
    expect(container.querySelector('#gm-prep-btn').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(container.querySelector('#gm-prep-btn'));
    expect(gmPrepActiveSignal.value).toBe(false);
  });
});
