/**
 * Header after menu consolidation - Settings / Theme / Tour / Maps moved
 * into the lower-left GlobalMenu, and the chat-tool chips (Mode / OOC /
 * Browse) folded into the composer and GlobalMenu. The header keeps only
 * live controls: presence, GM tools, prep, sync, leave.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { h } from 'preact';
import { Header } from '../ui/Header.jsx';

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

  it('keeps the live controls: GM tools, New, sync', () => {
    render(h(Header, { ui: makeUi() }));
    expect(screen.getByRole('button', { name: /open gm tools/i })).not.toBeNull();
    expect(document.getElementById('new-entity-btn')).not.toBeNull();
    expect(document.querySelector('[data-sync-status]')).not.toBeNull();
  });
});
