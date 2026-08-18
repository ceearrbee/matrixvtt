/**
 * ComposerActionsPopover - the mobile-only floating popover that holds
 * the quick dice, formula+Roll, adv/dis, secret roll, macros, and the
 * IC/OOC mode toggle. Pins the contract for the handlers it wires and
 * the outside-click/Escape close (the rpglog-borrowed pattern).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { ComposerActionsPopover } from '../ui/ComposerActionsPopover.jsx';
import { secretRollSignal, chatModeSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';

function makeUi(overrides = {}) {
  return {
    rollDice: vi.fn(),
    rollWithAdvantage: vi.fn(),
    rollWithDisadvantage: vi.fn(),
    toggleSecretRoll: vi.fn(),
    saveCurrentFormula: vi.fn(),
    rollMacro: vi.fn(),
    nextTurn: vi.fn(),
    state: {
      isGM: () => false,
      settings: { systemConfig: { rolls: { advantage: true, disadvantage: true } } },
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  secretRollSignal.value = false;
  chatModeSignal.value = 'say';
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
});

describe('ComposerActionsPopover', () => {
  it('clicking d20 calls ui.rollDice with that die', () => {
    const ui = makeUi();
    const { getByLabelText } = render(
      h(ComposerActionsPopover, { ui, selected: 'd20', onSelectedChange: () => {}, onClose: () => {} }),
    );
    fireEvent.click(getByLabelText('Roll d20'));
    expect(ui.rollDice).toHaveBeenCalledWith('d20');
  });

  it('Adv / Dis call the matching ui helpers', () => {
    const ui = makeUi();
    const { getByLabelText } = render(
      h(ComposerActionsPopover, { ui, selected: 'd20', onSelectedChange: () => {}, onClose: () => {} }),
    );
    fireEvent.click(getByLabelText('Roll with advantage'));
    fireEvent.click(getByLabelText('Roll with disadvantage'));
    expect(ui.rollWithAdvantage).toHaveBeenCalledOnce();
    expect(ui.rollWithDisadvantage).toHaveBeenCalledOnce();
  });

  it('selecting a speaking mode updates chatModeSignal', () => {
    chatModeSignal.value = 'say';
    const ui = makeUi();
    const { getByLabelText } = render(
      h(ComposerActionsPopover, { ui, selected: 'd20', onSelectedChange: () => {}, onClose: () => {} }),
    );
    fireEvent.click(getByLabelText('OOC'));
    expect(chatModeSignal.value).toBe('ooc');
    fireEvent.click(getByLabelText('Describe'));
    expect(chatModeSignal.value).toBe('describe');
    fireEvent.click(getByLabelText('Say'));
    expect(chatModeSignal.value).toBe('say');
  });

  it('closes on outside click and on Escape', () => {
    const onClose = vi.fn();
    const ui = makeUi();
    render(
      h(ComposerActionsPopover, { ui, selected: 'd20', onSelectedChange: () => {}, onClose }),
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
    onClose.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
