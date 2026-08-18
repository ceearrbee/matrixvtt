/**
 * QuickTray - rpglog-style one-tap action row above the composer.
 *
 * Three buttons mapped to existing MatrixVTT functionality:
 *   d20    → ui.rollDice('d20')
 *   ▶      → ui.nextTurn() (disabled when no combat active)
 *   IC/OOC → toggles chatModeSignal between 'say' and 'ooc'
 *
 * The former ★ macros button opened a popup nothing rendered; macros
 * live in the adjacent DiceBar extras (desktop) and the composer
 * actions popover (mobile).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { QuickTray } from '../ui/QuickTray.jsx';
import { chatModeSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';

function makeUi(opts = {}) {
  return {
    rollDice: vi.fn(),
    nextTurn: vi.fn(),
    state: {
      isGM: () => opts.isGM ?? true,
      initiative: opts.initiative ?? { active: false, round: 0, order: [] },
    },
  };
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
});

afterEach(cleanup);

describe('QuickTray', () => {
  it('renders the three canonical buttons', () => {
    const { container } = render(h(QuickTray, { ui: makeUi() }));
    for (const k of ['d20', 'next-turn', 'mode-toggle']) {
      expect(container.querySelector(`[data-quick="${k}"]`), `missing ${k}`).not.toBeNull();
    }
    expect(container.querySelector('[data-quick="macros"]')).toBeNull();
  });

  it('d20 button rolls a d20', () => {
    const ui = makeUi();
    const { container } = render(h(QuickTray, { ui }));
    fireEvent.click(container.querySelector('[data-quick="d20"]'));
    expect(ui.rollDice).toHaveBeenCalledWith('d20');
  });

  it('▶ next-turn button calls ui.nextTurn when combat is active', () => {
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{}] };
    const ui = makeUi({ initiative: { active: true } });
    const { container } = render(h(QuickTray, { ui }));
    const btn = container.querySelector('[data-quick="next-turn"]');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(ui.nextTurn).toHaveBeenCalled();
  });

  it('▶ next-turn is disabled when no combat is active', () => {
    const ui = makeUi();
    const { container } = render(h(QuickTray, { ui }));
    const btn = container.querySelector('[data-quick="next-turn"]');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(ui.nextTurn).not.toHaveBeenCalled();
  });

  it('IC/OOC toggle flips chatModeSignal between say and ooc', () => {
    const { container } = render(h(QuickTray, { ui: makeUi() }));
    const btn = container.querySelector('[data-quick="mode-toggle"]');
    expect(chatModeSignal.value).toBe('say');
    fireEvent.click(btn);
    expect(chatModeSignal.value).toBe('ooc');
    fireEvent.click(btn);
    expect(chatModeSignal.value).toBe('say');
  });

  it('IC/OOC toggle shows current mode in its label', () => {
    chatModeSignal.value = 'ooc';
    const { container } = render(h(QuickTray, { ui: makeUi() }));
    const btn = container.querySelector('[data-quick="mode-toggle"]');
    expect(btn.textContent).toBe('OOC');
    chatModeSignal.value = 'say';
    cleanup();
    const { container: c2 } = render(h(QuickTray, { ui: makeUi() }));
    expect(c2.querySelector('[data-quick="mode-toggle"]').textContent).toBe('IC');
  });

  it('IC/OOC label says IC when in describe mode too (non-OOC)', () => {
    chatModeSignal.value = 'describe';
    const { container } = render(h(QuickTray, { ui: makeUi() }));
    expect(container.querySelector('[data-quick="mode-toggle"]').textContent).toBe('IC');
  });
});
