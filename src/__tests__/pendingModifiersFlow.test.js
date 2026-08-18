/**
 * Invoking a `tagged_list`
 * row pushes its `modifier` onto `character.pending_modifiers`; the
 * next attribute/skill roll for that character consumes the stack
 * (sums values, clears the array, surfaces sources in the label).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';
import { rollAttributeCheck, rollSkillCheck } from '../ui/dice-helpers.js';

function makeUi({ character, patchEntity = vi.fn(), diceRoll } = {}) {
  const state = {
    canEditEntity: () => true,
    isGM: () => true,
    settings: { systemConfig: { rolls: { attribute: '4dF+{mod}', skill: '4dF+{bonus}' } } },
    getCurrentCharacter: () => character,
  };
  return {
    state,
    chat: { announceMessage: vi.fn() },
    widgetManager: { userId: '@me:hs', displayName: 'Player' },
    patchEntity: (id, patch) => {
      Object.assign(character, patch);
      patchEntity(id, patch);
    },
    diceRoller: {
      roll: diceRoll ?? ((formula) => ({ formula, rolls: [1], modifier: 0, result: 1 })),
    },
    _calcModifier: (v) => Number(v) || 0,
    _secretRoll: false,
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('pending modifiers - push on Invoke', () => {
  it('appends {value, source} to character.pending_modifiers on Invoke', () => {
    const patchEntity = vi.fn();
    const character = { id: 'c1', aspects: ['Trouble follows me'], fate_points: 3 };
    const ui = makeUi({ character, patchEntity });
    render(_kindsForTest.tagged_list({
      ui, character, config: {
        kind: 'tagged_list', field: 'aspects', label: 'Aspects',
        row_action: {
          label: 'Invoke',
          announce: '{actor} invokes [{value}]',
          decrement_field: 'fate_points',
          modifier: 2,
        },
      },
    }));
    fireEvent.click(screen.getByRole('button', { name: /invoke/i }));
    // patchEntity should have been called with both pending_modifiers AND fate_points decrement
    const calls = patchEntity.mock.calls.map(([, patch]) => patch);
    const pendingPatch = calls.find((p) => 'pending_modifiers' in p);
    expect(pendingPatch).toBeTruthy();
    expect(pendingPatch.pending_modifiers).toEqual([
      { value: 2, source: 'Trouble follows me' },
    ]);
  });

  it('stacks modifiers when Invoke is clicked twice on different aspects', () => {
    const patchEntity = vi.fn();
    const character = { id: 'c1', aspects: ['Aspect A', 'Aspect B'], fate_points: 3 };
    const ui = makeUi({ character, patchEntity });
    render(_kindsForTest.tagged_list({
      ui, character, config: {
        kind: 'tagged_list', field: 'aspects', label: 'Aspects',
        row_action: { label: 'Invoke', announce: '...', decrement_field: 'fate_points', modifier: 2 },
      },
    }));
    const buttons = screen.getAllByRole('button', { name: /invoke/i });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(character.pending_modifiers).toEqual([
      { value: 2, source: 'Aspect A' },
      { value: 2, source: 'Aspect B' },
    ]);
  });

  it('does NOT push pending_modifiers when row_action has no modifier', () => {
    const character = { id: 'c1', aspects: ['Bond'], hold: 2 };
    const ui = makeUi({ character });
    render(_kindsForTest.tagged_list({
      ui, character, config: {
        kind: 'tagged_list', field: 'bonds', label: 'Bonds',
        row_action: { label: 'Resolve', announce: '...', decrement_field: 'hold' },
      },
    }));
    // No row_action.modifier → no buttons even render for an empty bonds[]; use a real list
    // Rebuild with bonds populated
    document.body.innerHTML = '';
    character.bonds = ['Trust'];
    render(_kindsForTest.tagged_list({
      ui, character, config: {
        kind: 'tagged_list', field: 'bonds', label: 'Bonds',
        row_action: { label: 'Resolve', announce: '...', decrement_field: 'hold' },
      },
    }));
    fireEvent.click(screen.getByRole('button', { name: /resolve/i }));
    expect(character.pending_modifiers).toBeUndefined();
  });
});

describe('pending modifiers - consume on roll', () => {
  it('rollAttributeCheck sums + clears pending_modifiers, adding to mod', () => {
    const character = {
      id: 'c1',
      pending_modifiers: [
        { value: 2, source: 'Trouble follows me' },
        { value: 2, source: 'Quick thinking' },
      ],
    };
    const rolled = [];
    const ui = makeUi({
      character,
      diceRoll: (formula) => { rolled.push(formula); return { formula, rolls: [0], modifier: 0, result: 0 }; },
    });
    rollAttributeCheck(ui, 'Clever', 1);
    // Base mod from rollAttributeCheck is 1; pending adds +4 → +5 final
    expect(rolled[0]).toBe('4dF+5');
    // Pending stack is cleared
    expect(character.pending_modifiers).toEqual([]);
  });

  it('rollSkillCheck likewise consumes pending modifiers', () => {
    const character = {
      id: 'c1',
      pending_modifiers: [{ value: 2, source: 'Burning Hands' }],
    };
    const rolled = [];
    const ui = makeUi({
      character,
      diceRoll: (formula) => { rolled.push(formula); return { formula, rolls: [0], modifier: 0, result: 0 }; },
    });
    rollSkillCheck(ui, 'athletics', 3);
    expect(rolled[0]).toBe('4dF+5'); // 3 + 2
    expect(character.pending_modifiers).toEqual([]);
  });

  it('a roll with no pending_modifiers is unchanged', () => {
    const character = { id: 'c1' };
    const rolled = [];
    const ui = makeUi({
      character,
      diceRoll: (formula) => { rolled.push(formula); return { formula, rolls: [0], modifier: 0, result: 0 }; },
    });
    rollAttributeCheck(ui, 'Clever', 2);
    expect(rolled[0]).toBe('4dF+2');
  });

  it('a roll when no current character is selected is unchanged and does not throw', () => {
    const rolled = [];
    const ui = {
      state: {
        settings: { systemConfig: { rolls: { attribute: '4dF+{mod}' } } },
        getCurrentCharacter: () => null,
      },
      diceRoller: { roll: (formula) => { rolled.push(formula); return { formula, rolls: [0], modifier: 0, result: 0 }; } },
      _calcModifier: (v) => Number(v) || 0,
      _secretRoll: false,
    };
    expect(() => rollAttributeCheck(ui, 'Clever', 1)).not.toThrow();
    expect(rolled[0]).toBe('4dF+1');
  });
});
