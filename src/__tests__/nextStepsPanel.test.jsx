/**
 * The next-steps panel is the shell's single first-run surface: one
 * row of chips, each chip a working CTA, out of the way once the table
 * is set up or the user dismisses it.
 *
 * It shipped first as a four-row list with a hint sentence and a
 * separate button per row - about 260px, a quarter of the shell, sat
 * on top of the map. A first-run aid that costs a quarter of the
 * screen is the density problem it was meant to answer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { NextSteps } from '../ui/NextSteps.jsx';
import { showInvitePlayerModal } from '../ui/InvitePlayerModal.jsx';
import {
  mapsSignal, tokensSignal, charactersSignal, initiativeSignal, roomMembersSignal,
} from '../state/signals.js';
import { tableModeSignal, resetUiSignals } from '../state/ui-signals.js';

vi.mock('../ui/InvitePlayerModal.jsx', () => ({ showInvitePlayerModal: vi.fn() }));

function makeUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      maps: new Map(), tokens: new Map(), characters: new Map(),
      initiative: { active: false, order: [] },
      roomMembers: [{ userId: '@gm:hs' }],
    },
    widgetManager: { userId: '@gm:hs', roomId: '!r:hs' },
    openMapsPanel: vi.fn(),
    beginTokenPlacement: vi.fn(),
    rollInitiative: vi.fn(),
  });
}

describe('NextSteps panel', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiSignals();
    mapsSignal.value = new Map();
    tokensSignal.value = new Map();
    charactersSignal.value = new Map();
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
    roomMembersSignal.value = [{ userId: '@gm:hs' }];
  });
  afterEach(() => {
    cleanup();
    resetUiSignals();
  });

  it('offers a GM in a room with no campaign one chip that opens setup', () => {
    const ui = makeUi();
    ui.state.yjs = { settingsMap: new Map() };
    ui.showFirstTimeSetup = vi.fn();
    const { container } = render(h(NextSteps, { ui }));
    const chips = container.querySelectorAll('.next-steps__chip');
    expect(chips.length).toBe(1);
    fireEvent.click(container.querySelector('[data-step="setup"]'));
    expect(ui.showFirstTimeSetup).toHaveBeenCalled();
  });

  it('tells a player in a room with no campaign that chat still works', () => {
    const ui = makeUi({ isGM: false });
    ui.state.yjs = { settingsMap: new Map() };
    const { container } = render(h(NextSteps, { ui }));
    expect(container.querySelector('.next-steps__chip')).toBeNull();
    expect(container.textContent).toMatch(/no campaign in this room yet/i);
  });

  it('renders one chip per step', () => {
    const { container } = render(h(NextSteps, { ui: makeUi() }));
    expect(container.querySelectorAll('.next-steps__chip').length).toBe(4);
  });

  it('spends no vertical space on hint prose or a second button column', () => {
    const { container } = render(h(NextSteps, { ui: makeUi() }));
    // The hints are what made this a quarter-screen panel; they live in
    // each chip's tooltip now.
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('.next-steps__hint')).toBeNull();
    // The chip IS the CTA - no label plus a separate button beside it.
    expect(container.querySelectorAll('button').length)
      .toBe(container.querySelectorAll('.next-steps__chip').length + 1); // + Dismiss
  });

  it('keeps each step explanation reachable as the chip tooltip', () => {
    const { container } = render(h(NextSteps, { ui: makeUi() }));
    const chip = container.querySelector('[data-step="map"]');
    expect(chip.getAttribute('title')).toMatch(/battle map/i);
  });

  it('marks a done step instead of hiding it, so progress is visible', () => {
    const ui = makeUi();
    ui.state.roomMembers = [{ userId: '@gm:hs' }, { userId: '@bo:hs' }];
    roomMembersSignal.value = ui.state.roomMembers;
    const { container } = render(h(NextSteps, { ui }));
    const done = container.querySelectorAll('.next-steps__chip[data-done="true"]');
    expect(done.length).toBe(1);
    expect(done[0].textContent).toMatch(/invite/i);
  });

  // A map is loaded first because the token chip waits on one - see
  // nextStepsBlockedChips for what a chip does before its turn.
  it('routes each CTA at the surface that completes it', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', image_url: 'mxc://x/y' }]]);
    const ui = makeUi();
    ui.state.maps = mapsSignal.value;
    const { container } = render(h(NextSteps, { ui }));
    const click = (key) => fireEvent.click(container.querySelector(`[data-step="${key}"]`));
    click('map');
    expect(ui.openMapsPanel).toHaveBeenCalled();
    click('invite');
    expect(showInvitePlayerModal).toHaveBeenCalledWith(ui);
    click('token');
    expect(ui.beginTokenPlacement).toHaveBeenCalled();
  });

  it('disappears once every step is done', () => {
    const ui = makeUi({ isGM: false });
    ui.state.characters = new Map([['c1', { id: 'c1', claimed_by_user_id: '@gm:hs' }]]);
    charactersSignal.value = ui.state.characters;
    const { container } = render(h(NextSteps, { ui }));
    expect(container.querySelector('.next-steps')).toBeNull();
  });

  it('stays dismissed once the user closes it', () => {
    const ui = makeUi();
    const { container, rerender } = render(h(NextSteps, { ui }));
    fireEvent.click(container.querySelector('.next-steps__dismiss'));
    rerender(h(NextSteps, { ui }));
    expect(container.querySelector('.next-steps')).toBeNull();
  });

  it('auto-hides when combat is active', () => {
    const ui = makeUi();
    ui.state.initiative = { active: true, order: [] };
    const { container } = render(h(NextSteps, { ui }));
    expect(container.querySelector('.next-steps')).toBeNull();
  });

  it('auto-hides for solo or demo session once map, token, and combat are done', () => {
    const ui = makeUi({ isGM: true });
    ui.state.roomMembers = [{ userId: '@gm:hs' }]; // memberCount = 1
    ui.state.maps = new Map([['m1', { id: 'm1', image_url: 'mxc://x/y' }]]);
    ui.state.tokens = new Map([['t1', { id: 't1', sheet_id: 'c1' }]]);
    ui.state.initiative = { active: false, order: [{ token_id: 't1' }] };
    mapsSignal.value = ui.state.maps;
    tokensSignal.value = ui.state.tokens;
    initiativeSignal.value = ui.state.initiative;
    roomMembersSignal.value = ui.state.roomMembers;

    const { container } = render(h(NextSteps, { ui }));
    expect(container.querySelector('.next-steps')).toBeNull();
  });
});
