/**
 * Header after menu consolidation - Settings / Theme / Maps moved into
 * the lower-left GlobalMenu, and the chat-tool chips (Mode / OOC /
 * Browse) folded into the composer and GlobalMenu. The header keeps only
 * live controls: presence, prep, sync, leave; the authoring entries ride
 * the prep axis.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { Header } from '../ui/Header.jsx';
import { gmPrepActiveSignal } from '../state/ui-signals.js';

function makeUi() {
  return {
    state: {
      isGM: () => true,
      settings: { name: 'Test Room', gm_user_ids: [] },
      initiative: { active: false, order: [], round: 0, current_index: 0 },
      roomMembers: [],
    },
    widgetManager: { userId: 'u', canLeave: false },
    toggleTheme() {}, openSettings() {}, openMapsPanel() {},
  };
}

describe('Header after menu consolidation', () => {
  beforeEach(() => { localStorage.clear(); gmPrepActiveSignal.value = false; });
  afterEach(cleanup);

  it('no longer renders Settings / Theme / Tour / Maps controls', () => {
    render(h(Header, { ui: makeUi() }));
    expect(document.getElementById('settings-btn')).toBeNull();
    expect(document.getElementById('theme-toggle')).toBeNull();
    expect(document.getElementById('restart-tour-btn-header')).toBeNull();
    expect(document.getElementById('maps-btn')).toBeNull();
  });

  it('renders no chat-tool chips and no overflow toggle', () => {
    render(h(Header, { ui: makeUi() }));
    expect(document.querySelector('[data-chat-tool]')).toBeNull();
    expect(document.querySelector('.vtt-header__overflow-toggle')).toBeNull();
    expect(document.querySelector('.vtt-header__secondary')).toBeNull();
  });

  it('keeps sync live, and discloses GM tools and New with the prep workspace', () => {
    render(h(Header, { ui: makeUi() }));
    expect(document.querySelector('[data-sync-status]')).not.toBeNull();
    expect(document.getElementById('gm-controls-btn')).toBeNull();
    expect(document.getElementById('new-entity-btn')).toBeNull();

    cleanup();
    gmPrepActiveSignal.value = true;
    render(h(Header, { ui: makeUi() }));
    expect(screen.getByRole('button', { name: /open gm tools/i })).not.toBeNull();
    expect(document.getElementById('new-entity-btn')).not.toBeNull();
  });
});
