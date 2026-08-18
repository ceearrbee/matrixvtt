/**
 * CombatInitiativeStrip - horizontal turn-order strip pinned beneath
 * the map in Combat mode. Each combatant: color dot + name + HP. The
 * active combatant gets a highlight. GM sees an "End Turn" button.
 *
 * Pure presentation - pulls from `initiativeSignal` / `tokensSignal`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { CombatInitiativeStrip } from '../ui/CombatInitiativeStrip.jsx';
import { initiativeSignal, tokensSignal } from '../state/signals.js';

function makeUi({ isGM = true } = {}) {
  const order = [
    { token_id: 'tok-a', name: 'Aria', hp_current: 28, hp_max: 40, initiative: 18 },
    { token_id: 'tok-b', name: 'Goblin', hp_current: 4, hp_max: 7, initiative: 11 },
  ];
  return {
    state: {
      isGM: () => isGM,
      initiative: { active: true, round: 3, current_index: 0, order },
      tokens: new Map([
        ['tok-a', { id: 'tok-a', name: 'Aria', color: '#185FA5' }],
        ['tok-b', { id: 'tok-b', name: 'Goblin', color: '#993C1D' }],
      ]),
    },
    nextTurn: vi.fn(),
  };
}

describe('CombatInitiativeStrip', () => {
  beforeEach(() => {
    initiativeSignal.value = {
      active: true, round: 3, current_index: 0,
      order: [
        { token_id: 'tok-a', name: 'Aria', hp_current: 28, hp_max: 40 },
        { token_id: 'tok-b', name: 'Goblin', hp_current: 4, hp_max: 7 },
      ],
    };
    tokensSignal.value = new Map();
  });
  afterEach(() => { cleanup(); });

  it('renders one row per combatant', () => {
    const { container } = render(h(CombatInitiativeStrip, { ui: makeUi() }));
    expect(container.querySelectorAll('.combat-init-strip__row').length).toBe(2);
  });

  it('marks the active combatant with data-current', () => {
    const { container } = render(h(CombatInitiativeStrip, { ui: makeUi() }));
    const rows = container.querySelectorAll('.combat-init-strip__row');
    expect(rows[0].getAttribute('data-current')).toBe('true');
    expect(rows[1].getAttribute('data-current')).toBe('false');
  });

  it('shows HP fraction per row', () => {
    const { container } = render(h(CombatInitiativeStrip, { ui: makeUi() }));
    expect(container.textContent).toContain('28/40');
    expect(container.textContent).toContain('4/7');
  });

  it('GM sees an End Turn button that calls ui.endTurn()', () => {
    const ui = makeUi({ isGM: true });
    const { container } = render(h(CombatInitiativeStrip, { ui }));
    const btn = container.querySelector('[data-action="end-turn"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    expect(ui.nextTurn).toHaveBeenCalled();
  });

  it('non-GMs do NOT see End Turn unless it is their token', () => {
    const ui = makeUi({ isGM: false });
    ui._isMyCombatTurn = () => false;
    const { container } = render(h(CombatInitiativeStrip, { ui }));
    expect(container.querySelector('[data-action="end-turn"]')).toBeNull();
  });

  it('renders nothing when combat is not active', () => {
    const ui = makeUi();
    ui.state.initiative = { active: false, round: 0, current_index: 0, order: [] };
    const { container } = render(h(CombatInitiativeStrip, { ui }));
    expect(container.querySelector('.combat-init-strip')).toBeNull();
  });
});
