/**
 * The next-steps checklist is per-user state. It shipped reading and
 * writing a bare `vtt:hide-next-steps`, so two accounts sharing a
 * browser shared one dismissal: a player signing in after a GM
 * dismissed it never saw their own checklist. That is the exact class
 * `src/utils/user-storage.js` exists to prevent: localStorage caches
 * that survive logout must be user-scoped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { NextSteps } from '../ui/NextSteps.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';
import {
  mapsSignal, tokensSignal, charactersSignal, initiativeSignal, roomMembersSignal,
} from '../state/signals.js';

vi.mock('../ui/InvitePlayerModal.jsx', () => ({ showInvitePlayerModal: vi.fn() }));

function makeUi(userId) {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      maps: new Map(), tokens: new Map(), characters: new Map(),
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      roomMembers: [{ userId }],
    },
    widgetManager: { userId, roomId: '!r:hs' },
    openMapsPanel: vi.fn(),
  });
}

describe('next-steps dismissal is per user', () => {
  beforeEach(() => {
    localStorage.clear();
    mapsSignal.value = new Map();
    tokensSignal.value = new Map();
    charactersSignal.value = new Map();
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    roomMembersSignal.value = [{ userId: '@gm:hs' }];
  });
  afterEach(cleanup);

  it('writes the dismissal under the user-scoped key', () => {
    const { container } = render(h(NextSteps, { ui: makeUi('@gm:hs') }));
    fireEvent.click(container.querySelector('.next-steps__dismiss'));
    expect(localStorage.getItem(`${STORAGE_KEYS.HIDE_NEXT_STEPS}::@gm:hs`)).toBe('1');
    expect(localStorage.getItem(STORAGE_KEYS.HIDE_NEXT_STEPS)).toBeNull();
  });

  it('leaves a second account its own checklist', () => {
    const first = render(h(NextSteps, { ui: makeUi('@gm:hs') }));
    fireEvent.click(first.container.querySelector('.next-steps__dismiss'));
    expect(first.container.querySelector('.next-steps')).toBeNull();
    cleanup();

    const second = render(h(NextSteps, { ui: makeUi('@bo:hs') }));
    expect(second.container.querySelector('.next-steps')).not.toBeNull();
  });

  it('still renders before anyone has dismissed anything', () => {
    const { container } = render(h(NextSteps, { ui: makeUi('@gm:hs') }));
    expect(container.querySelector('.next-steps')).not.toBeNull();
  });
});
