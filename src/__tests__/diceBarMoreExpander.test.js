/**
 * Dice bar condensation: Adv/Dis/secret/save/macros are hidden by default
 * behind a ▾ More expander. Clicking the expander reveals them inline.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';

function mkUi() {
  return {
    state: {
      isGM: () => true,
      tokens: new Map(),
      characters: new Map(),
      settings: { systemConfig: { rolls: { advantage: '2d20kh1', disadvantage: '2d20kl1' } } },
    },
    widgetManager: { userId: '@me:hs', isAppClient: true },
    _latestDiceResult: '',
    sendChatMessage: vi.fn(),
    setSpeakAs: vi.fn(),
    rollDice: vi.fn(),
    toggleSecretRoll: vi.fn(),
    rollMacro: vi.fn(),
    saveCurrentFormula: vi.fn(),
  };
}

/** Open the dice strip toggle so the ▾ More button is reachable. The
 *  composer cohesion pass collapsed the d4..d20 + Roll + ▾ row behind
 *  a `Dice ▾` chip; the tests below pin the *behavior of the inline
 *  ▾ More expander* once the strip itself is visible. */
function openDiceStrip(container) {
  fireEvent.click(container.querySelector('[data-dice-strip-toggle]'));
}

describe('DiceBar - ▾ More expander', () => {
  it('Adv/Dis/secret/save/macros are hidden by default', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    openDiceStrip(container);
    expect(container.querySelector('#adv-roll-btn')).toBeNull();
    expect(container.querySelector('#dis-roll-btn')).toBeNull();
    expect(container.querySelector('#secret-roll-btn')).toBeNull();
    expect(container.querySelector('#save-formula-btn')).toBeNull();
    expect(container.querySelector('#dice-macros-select')).toBeNull();
  });

  it('shows the ▾ More button as the gateway', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    openDiceStrip(container);
    expect(container.querySelector('[data-dice-more]')).not.toBeNull();
  });

  it('clicking ▾ reveals the extras inline', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    openDiceStrip(container);
    fireEvent.click(container.querySelector('[data-dice-more]'));
    expect(container.querySelector('#adv-roll-btn')).not.toBeNull();
    expect(container.querySelector('#dis-roll-btn')).not.toBeNull();
    expect(container.querySelector('#secret-roll-btn')).not.toBeNull();
    expect(container.querySelector('#save-formula-btn')).not.toBeNull();
    expect(container.querySelector('#dice-macros-select')).not.toBeNull();
  });
});

describe('DiceBar - dice strip toggle (composer cohesion)', () => {
  it('dice strip is hidden by default', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    expect(container.querySelector('[data-dice="d20"]')).toBeNull();
    expect(container.querySelector('#dice-modifier')).toBeNull();
    expect(container.querySelector('#roll-dice')).toBeNull();
  });

  it('Dice ▾ chip is visible as the gateway', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    expect(container.querySelector('[data-dice-strip-toggle]')).not.toBeNull();
  });

  it('clicking the Dice ▾ chip reveals the quick-roll strip', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    fireEvent.click(container.querySelector('[data-dice-strip-toggle]'));
    for (const d of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']) {
      expect(container.querySelector(`[data-dice="${d}"]`), `missing ${d}`)
        .not.toBeNull();
    }
    expect(container.querySelector('#roll-dice')).not.toBeNull();
  });

  it('toggle flips aria-expanded', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    const toggle = container.querySelector('[data-dice-strip-toggle]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
