/**
 * The header exit button returns to the room list: it dispatches
 * RETURN_TO_ROOMS with no confirmation dialog and never LEAVE_ROOM.
 * The destructive Leave lives in the global menu.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { Header } from '../ui/Header.jsx';
import { VTT_EVENTS } from '../utils/constants.js';

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

describe('header room-list button', () => {
  it('dispatches RETURN_TO_ROOMS on click, with no dialog and no LEAVE_ROOM', () => {
    const events = [];
    const onReturn = () => events.push('return');
    const onLeave = () => events.push('leave');
    window.addEventListener(VTT_EVENTS.RETURN_TO_ROOMS, onReturn);
    window.addEventListener(VTT_EVENTS.LEAVE_ROOM, onLeave);
    try {
      render(h(Header, { ui: makeUi() }), host);
      const btn = host.querySelector('#back-to-rooms-btn-header');
      expect(btn).not.toBeNull();
      btn.click();
      expect(events).toEqual(['return']);
      expect(document.querySelector('.modal-overlay')).toBeNull();
    } finally {
      window.removeEventListener(VTT_EVENTS.RETURN_TO_ROOMS, onReturn);
      window.removeEventListener(VTT_EVENTS.LEAVE_ROOM, onLeave);
    }
  });

  it('is not styled as destructive and names the destination', () => {
    render(h(Header, { ui: makeUi() }), host);
    const btn = host.querySelector('#back-to-rooms-btn-header');
    expect(btn.getAttribute('aria-label')).toBe('Return to room list');
    expect(btn.classList.contains('dbt--danger')).toBe(false);
  });
});
