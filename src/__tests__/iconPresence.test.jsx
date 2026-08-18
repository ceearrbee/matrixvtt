/**
 * Editorial line icons: the chrome surfaces render an inline SVG
 * (never an emoji glyph), and `aria-label` is preserved on the parent
 * button so screen readers still announce the action.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { Header } from '../ui/Header.jsx';

// Toaster mount in the header indirectly pulls Sonner; mock to avoid
// the DOM-side effect across tests.
vi.mock('sonner', () => ({ toast: () => {}, Toaster: () => null }));

let host;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { render(null, host); host.remove(); });

function makeUi() {
  return {
    state: {
      isGM: () => true,
      settings: { name: 'The Sunken Keep', gm_user_ids: ['@gm:s'] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      roomMembers: [],
    },
    widgetManager: { userId: '@gm:s', roomId: '!r:s', canLeave: true },
    toggleTheme: () => {},
    openSettings: () => {},
    openMapsPanel: () => {},
  };
}

describe('Phase C - line icon swap', () => {
  it('Header buttons render an SVG icon and keep their aria-label', () => {
    // Settings / Maps moved to the consolidated GlobalMenu; the rooms
    // button is the remaining icon button in the header.
    render(h(Header, { ui: makeUi() }), host);
    const roomsBtn = host.querySelector('#back-to-rooms-btn-header');
    expect(roomsBtn).not.toBeNull();
    expect(roomsBtn.querySelector('svg')).not.toBeNull();
    expect(roomsBtn.getAttribute('aria-label')).toBe('Return to room list');
  });

  it('Header buttons do not contain emoji glyphs in their text content', () => {
    render(h(Header, { ui: makeUi() }), host);
    // Walk all descendants (labels are wrapped in .dbt__label spans for
    // mobile hide-on-narrow). Text should mention Rooms and never
    // contain a door emoji.
    const text = host.querySelector('#back-to-rooms-btn-header').textContent ?? '';
    expect(text).not.toMatch(/🚪/);
    expect(text).toMatch(/Rooms/);
  });

  it('layout-toggle button is gone (conversation-first shell, no map/forum dichotomy)', () => {
    render(h(Header, { ui: makeUi() }), host);
    expect(host.querySelector('#layout-toggle-btn')).toBeNull();
  });
});
