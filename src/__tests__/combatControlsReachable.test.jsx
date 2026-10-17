import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { CombatInitiativeStrip } from '../ui/CombatInitiativeStrip.jsx';
import { CombatTab } from '../ui/CombatTab.jsx';
import { initiativeSignal, tokensSignal } from '../state/signals.js';

describe('Task 7: Reachable Combat Management & Semantic HP Meter', () => {
  afterEach(cleanup);

  describe('CombatInitiativeStrip semantic HpBar meter', () => {
    it('renders HpBar with role="meter", aria attributes, and data-zone="healthy" when > 50%', () => {
      const order = [{ token_id: 't1', name: 'Aria', hp_current: 80, hp_max: 100 }];
      const ui = {
        state: {
          isGM: () => true,
          initiative: { active: true, round: 1, current_index: 0, order },
          tokens: new Map([['t1', { id: 't1', name: 'Aria', color: '#00ff00' }]]),
        },
        _isMyCombatTurn: () => true,
      };
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatInitiativeStrip, { ui }));
      const meter = container.querySelector('.combat-init-strip__hp-bar');
      expect(meter).not.toBeNull();
      expect(meter.getAttribute('role')).toBe('meter');
      expect(meter.getAttribute('aria-label')).toBe('HP');
      expect(meter.getAttribute('aria-valuenow')).toBe('80');
      expect(meter.getAttribute('aria-valuemin')).toBe('0');
      expect(meter.getAttribute('aria-valuemax')).toBe('100');
      expect(meter.getAttribute('data-zone')).toBe('healthy');
    });

    it('renders data-zone="bloodied" when hp percentage is > 25% and <= 50%', () => {
      const order = [{ token_id: 't2', name: 'Bob', hp_current: 40, hp_max: 100 }];
      const ui = {
        state: {
          isGM: () => true,
          initiative: { active: true, round: 1, current_index: 0, order },
          tokens: new Map([['t2', { id: 't2', name: 'Bob', color: '#ffaa00' }]]),
        },
        _isMyCombatTurn: () => false,
      };
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatInitiativeStrip, { ui }));
      const meter = container.querySelector('.combat-init-strip__hp-bar');
      expect(meter).not.toBeNull();
      expect(meter.getAttribute('aria-valuenow')).toBe('40');
      expect(meter.getAttribute('data-zone')).toBe('bloodied');
    });

    it('renders data-zone="critical" when hp percentage is <= 25%', () => {
      const order = [{ token_id: 't3', name: 'Critter', hp_current: 10, hp_max: 100 }];
      const ui = {
        state: {
          isGM: () => true,
          initiative: { active: true, round: 1, current_index: 0, order },
          tokens: new Map([['t3', { id: 't3', name: 'Critter', color: '#ff0000' }]]),
        },
        _isMyCombatTurn: () => false,
      };
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatInitiativeStrip, { ui }));
      const meter = container.querySelector('.combat-init-strip__hp-bar');
      expect(meter).not.toBeNull();
      expect(meter.getAttribute('aria-valuenow')).toBe('10');
      expect(meter.getAttribute('data-zone')).toBe('critical');
    });

    it('omits HpBar when entry has no hp_max', () => {
      const order = [{ token_id: 't4', name: 'Ghost' }];
      const ui = {
        state: {
          isGM: () => true,
          initiative: { active: true, round: 1, current_index: 0, order },
          tokens: new Map([['t4', { id: 't4', name: 'Ghost' }]]),
        },
        _isMyCombatTurn: () => false,
      };
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatInitiativeStrip, { ui }));
      expect(container.querySelector('.combat-init-strip__hp-bar')).toBeNull();
    });
  });

  describe('CombatTab turn order and reachable controls', () => {
    function makeCombatUi({ active = true, isGM = true } = {}) {
      const order = [
        { token_id: 'tok-hero', name: 'Hero', hp_current: 25, hp_max: 30, initiative: 18 },
        { token_id: 'tok-goblin', name: 'Goblin', hp_current: 7, hp_max: 12, initiative: 12 },
      ];
      const tokens = new Map([
        ['tok-hero', { id: 'tok-hero', name: 'Hero', color: '#4a90e2', conditions: [] }],
        ['tok-goblin', { id: 'tok-goblin', name: 'Goblin', color: '#e24a4a', conditions: ['blinded'] }],
      ]);
      return {
        state: {
          isGM: () => isGM,
          initiative: { active, round: 1, current_index: 0, order },
          tokens,
          characters: new Map(),
          npcs: new Map(),
          settings: { systemConfig: { action_economy: [] } },
          widgetManager: { userId: 'user-gm' },
        },
        _isMyCombatTurn: () => true,
        adjustTokenHP: vi.fn(),
        setTurn: vi.fn(),
        removeFromInitiative: vi.fn(),
        nextTurn: vi.fn(),
        toggleCombatAction: vi.fn(),
      };
    }

    it('renders empty message when combat is inactive', () => {
      const ui = makeCombatUi({ active: false });
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatTab, { ui }));
      expect(container.textContent).toContain('Combat is not active.');
      expect(container.querySelector('.combat-tab__order')).toBeNull();
    });

    it('renders "Turn order" section with all combatants during active combat', () => {
      const ui = makeCombatUi({ active: true, isGM: true });
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatTab, { ui }));
      const orderSection = container.querySelector('.combat-tab__order');
      expect(orderSection).not.toBeNull();
      expect(orderSection.textContent).toContain('Turn order');

      const entries = orderSection.querySelectorAll('.ie');
      expect(entries).toHaveLength(2);
      expect(orderSection.textContent).toContain('Hero');
      expect(orderSection.textContent).toContain('Goblin');
    });

    it('provides reachable HP adjust buttons for current combatant', () => {
      const ui = makeCombatUi({ active: true, isGM: true });
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatTab, { ui }));
      const heroEntry = container.querySelector('.ie[data-token-id="tok-hero"]');
      expect(heroEntry).not.toBeNull();

      const hpAdjust = heroEntry.querySelector('.ie__hp-adjust');
      expect(hpAdjust).not.toBeNull();

      const adjustButtons = hpAdjust.querySelectorAll('.ie__hp-adjust-btn');
      expect(adjustButtons.length).toBeGreaterThanOrEqual(2);

      // Click +5 button
      const plusFive = Array.from(adjustButtons).find((b) => b.textContent === '+5');
      expect(plusFive).not.toBeUndefined();
      fireEvent.click(plusFive);
      expect(ui.adjustTokenHP).toHaveBeenCalledWith('tok-hero', 5);

      // Click -1 button
      const minusOne = Array.from(adjustButtons).find((b) => b.textContent === '-1');
      expect(minusOne).not.toBeUndefined();
      fireEvent.click(minusOne);
      expect(ui.adjustTokenHP).toHaveBeenCalledWith('tok-hero', -1);
    });

    it('expands inactive combatant row on expand click, exposing HP controls and turn management', () => {
      const ui = makeCombatUi({ active: true, isGM: true });
      initiativeSignal.value = ui.state.initiative;
      tokensSignal.value = ui.state.tokens;

      const { container } = render(h(CombatTab, { ui }));
      const goblinEntry = container.querySelector('.ie[data-token-id="tok-goblin"]');
      expect(goblinEntry).not.toBeNull();

      // Inactive row starts collapsed
      expect(goblinEntry.querySelector('.ie__hp-adjust')).toBeNull();

      // Click the expand toggle
      const expandToggle = goblinEntry.querySelector('.ie__expand-toggle');
      expect(expandToggle).not.toBeNull();
      fireEvent.click(expandToggle);

      // Now expanded: HP adjust buttons and management buttons appear
      const hpAdjust = goblinEntry.querySelector('.ie__hp-adjust');
      expect(hpAdjust).not.toBeNull();

      const minusOne = Array.from(hpAdjust.querySelectorAll('.ie__hp-adjust-btn')).find((b) => b.textContent === '-1');
      expect(minusOne).not.toBeUndefined();
      fireEvent.click(minusOne);
      expect(ui.adjustTokenHP).toHaveBeenCalledWith('tok-goblin', -1);

      // Jump to turn button is reachable
      const setTurnBtn = goblinEntry.querySelector('.ie__set-turn');
      expect(setTurnBtn).not.toBeNull();
      fireEvent.click(setTurnBtn);
      expect(ui.setTurn).toHaveBeenCalledWith(1);

      // Remove from initiative button is reachable
      const removeBtn = goblinEntry.querySelector('.ie__remove');
      expect(removeBtn).not.toBeNull();
      fireEvent.click(removeBtn);
      expect(ui.removeFromInitiative).toHaveBeenCalledWith('tok-goblin');
    });
  });
});
