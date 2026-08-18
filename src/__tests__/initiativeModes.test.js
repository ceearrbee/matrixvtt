/**
 * Initiative modes - verifies rollInitiative dispatches correctly for
 * 'individual' | 'side' | 'static' modes, and that getInitiativeMode
 * reads from localStorage override / systemConfig default.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/ui-helpers.js', () => ({
  ModalFactory: {
    create: vi.fn(({ body }) => {
      const el = document.createElement('div');
      el.innerHTML = body;
      return el;
    }),
  },
  trapFocusIn: vi.fn(() => () => {}),
}));

import { createMinimalUI } from '../ui/ui-methods.js';
import { getInitiativeMode } from '../ui/combat-manager.js';

function makeUI(opts = {}) {
  const sendStateEvent = opts.sendStateEvent ?? vi.fn().mockResolvedValue(undefined);
  const tokens = new Map([
    ['t1', { id: 't1', name: 'Hero', sheet_id: 'c1', disposition: 'friendly' }],
    ['t2', { id: 't2', name: 'Goblin', sheet_id: 'n1', disposition: 'hostile' }],
    ['t3', { id: 't3', name: 'Townsfolk', sheet_id: null, disposition: 'neutral' }],
  ]);
  const state = {
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    tokens,
    characters: new Map([['c1', { attributes: { dex: 14 } }]]),
    npcs: new Map([['n1', { attributes: { dex: 12 } }]]),
    sendStateEvent,
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [], systemConfig: opts.systemConfig ?? { initiative: { mode: 'individual', tie_break_stat: 'dex' } } },
  };
  state.updateInitiative = async (i) => { state.initiative = i; return sendStateEvent('com.vtt.initiative', '', i); };
  state.clearInitiative = async () => {
    state.initiative = { active: false, round: 0, current_index: 0, order: [] };
    return sendStateEvent('com.vtt.initiative', '', state.initiative);
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.diceRoller = { roll: vi.fn().mockReturnValue({ result: 15 }) };
  ui.updateInitiativePanel = vi.fn();
  ui.updateHeader = vi.fn();
  return { ui, sendStateEvent };
}

describe('getInitiativeMode', () => {
  afterEach(() => { localStorage.removeItem('vtt:initiative-mode-override'); });

  it('returns ruleset default when no override', () => {
    const { ui } = makeUI({ systemConfig: { initiative: { mode: 'side', tie_break_stat: 'dex' } } });
    expect(getInitiativeMode(ui)).toBe('side');
  });

  it('returns "individual" fallback when systemConfig lacks initiative', () => {
    const { ui } = makeUI({ systemConfig: {} });
    expect(getInitiativeMode(ui)).toBe('individual');
  });

  it('localStorage override wins over ruleset default', () => {
    localStorage.setItem('vtt:initiative-mode-override', 'static');
    const { ui } = makeUI({ systemConfig: { initiative: { mode: 'side' } } });
    expect(getInitiativeMode(ui)).toBe('static');
  });

  it('"auto" override falls through to ruleset default', () => {
    localStorage.setItem('vtt:initiative-mode-override', 'auto');
    const { ui } = makeUI({ systemConfig: { initiative: { mode: 'side' } } });
    expect(getInitiativeMode(ui)).toBe('side');
  });
});

describe('rollInitiative - side mode', () => {
  it('assigns one initiative value per disposition', async () => {
    const { ui, sendStateEvent } = makeUI();
    await ui.rollInitiative('side');
    // One shared initiative per side; diceRoller.roll was called 3× (one per unique side).
    expect(ui.diceRoller.roll).toHaveBeenCalledTimes(3);
    // The persisted order should have 3 entries with side tags.
    const lastCall = sendStateEvent.mock.calls.at(-1);
    const initiative = lastCall[2];
    expect(initiative.order).toHaveLength(3);
    expect(initiative.order.every(e => ['friendly', 'hostile', 'neutral'].includes(e.side))).toBe(true);
    // Tokens sharing a disposition share an initiative value.
    const friendly = initiative.order.find(e => e.side === 'friendly');
    expect(friendly.initiative).toBe(15);
  });
});

describe('rollInitiative - static mode', () => {
  it('ranks by tie_break_stat without rolling', async () => {
    const { ui, sendStateEvent } = makeUI({ systemConfig: { initiative: { mode: 'static', tie_break_stat: 'dex' } } });
    await ui.rollInitiative('static');
    expect(ui.diceRoller.roll).not.toHaveBeenCalled();
    const initiative = sendStateEvent.mock.calls.at(-1)[2];
    // Order sorted descending by dex: hero (14) > goblin (12) > townsfolk (10 default)
    expect(initiative.order.map(e => e.token_id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('rollInitiative - individual mode with explicit submode', () => {
  beforeEach(() => {
    const modal = document.getElementById('init-mode-modal');
    if (modal) modal.remove();
  });

  it('randomize rolls every token', async () => {
    const { ui } = makeUI();
    await ui.rollInitiative('randomize');
    expect(ui.diceRoller.roll).toHaveBeenCalledTimes(3);
  });

  it('players sub-mode leaves PC entries null', async () => {
    const { ui, sendStateEvent } = makeUI();
    await ui.rollInitiative('players');
    const initiative = sendStateEvent.mock.calls.at(-1)[2];
    const hero = initiative.order.find(e => e.token_id === 't1');
    const goblin = initiative.order.find(e => e.token_id === 't2');
    expect(hero.initiative).toBeNull();
    expect(goblin.initiative).toBe(15);
  });
});
