/**
 * How a blocked chip behaves when it is clicked.
 *
 * "Add a token" on a mapless campaign used to arm placement mode over
 * a canvas that was not rendered: the mode stayed armed, invisibly,
 * and nothing the GM clicked next could finish it. "Start combat" with
 * no tokens fired a toast telling them to place tokens first. Both now
 * run the step they are waiting on, so a click always moves the table
 * forward, and both say so before they are clicked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { NextSteps } from '../ui/NextSteps.jsx';
import {
  mapsSignal, tokensSignal, charactersSignal, initiativeSignal, roomMembersSignal,
} from '../state/signals.js';

vi.mock('../ui/InvitePlayerModal.jsx', () => ({ showInvitePlayerModal: vi.fn() }));

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      maps: mapsSignal.value, tokens: tokensSignal.value, characters: new Map(),
      initiative: { active: false, order: [] },
      roomMembers: [{ userId: '@gm:hs' }],
    },
    widgetManager: { userId: '@gm:hs', roomId: '!r:hs' },
    openMapsPanel: vi.fn(),
    beginTokenPlacement: vi.fn(),
    rollInitiative: vi.fn(),
  });
}

function chip(container, key) {
  return container.querySelector(`[data-step="${key}"]`);
}

describe('blocked next-steps chips', () => {
  beforeEach(() => {
    localStorage.clear();
    mapsSignal.value = new Map();
    tokensSignal.value = new Map();
    charactersSignal.value = new Map();
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    roomMembersSignal.value = [{ userId: '@gm:hs' }];
  });
  afterEach(cleanup);

  it('marks the chips that are waiting on an earlier step', () => {
    const { container } = render(h(NextSteps, { ui: makeUi() }));
    expect(chip(container, 'token').dataset.blocked).toBe('true');
    expect(chip(container, 'combat').dataset.blocked).toBe('true');
    expect(chip(container, 'map').dataset.blocked).toBe('false');
    expect(chip(container, 'invite').dataset.blocked).toBe('false');
  });

  it('runs the blocking step rather than arming a mode that cannot finish', () => {
    const ui = makeUi();
    const { container } = render(h(NextSteps, { ui }));
    fireEvent.click(chip(container, 'token'));
    expect(ui.openMapsPanel).toHaveBeenCalled();
    expect(ui.beginTokenPlacement).not.toHaveBeenCalled();
  });

  it('does not fire the combat toast from a chip with no tokens to roll', () => {
    const ui = makeUi();
    const { container } = render(h(NextSteps, { ui }));
    fireEvent.click(chip(container, 'combat'));
    expect(ui.rollInitiative).not.toHaveBeenCalled();
    expect(ui.beginTokenPlacement).toHaveBeenCalled();
  });

  it('runs its own action once the prerequisite is met', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', image_url: 'mxc://x/y' }]]);
    const ui = makeUi();
    const { container } = render(h(NextSteps, { ui }));
    fireEvent.click(chip(container, 'token'));
    expect(ui.beginTokenPlacement).toHaveBeenCalled();
    expect(ui.openMapsPanel).not.toHaveBeenCalled();
  });

  it('tells the reader what the chip is waiting for', () => {
    const { container } = render(h(NextSteps, { ui: makeUi() }));
    expect(chip(container, 'token').title).toMatch(/map first/i);
  });
});
