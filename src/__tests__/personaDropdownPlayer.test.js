/**
 * The "Speak as" persona dropdown is not GM-only: players can speak
 * as characters they have claimed (and as tokens they own). For the
 * GM, every token appears.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';
import { chatModeSignal } from '../state/ui-signals.js';

function mkUi({ isGM, myUserId, tokens, characters = new Map() }) {
  return {
    state: {
      isGM: () => isGM,
      tokens: new Map(tokens),
      characters,
      settings: { systemConfig: { rolls: {} } },
    },
    widgetManager: { userId: myUserId, isAppClient: true },
    _latestDiceResult: '',
    sendChatMessage: vi.fn(),
    setSpeakAs: vi.fn(),
    rollDice: vi.fn(),
    toggleSecretRoll: vi.fn(),
    rollMacro: vi.fn(),
    saveCurrentFormula: vi.fn(),
  };
}

describe('DiceBar persona dropdown - non-GM scope', () => {
  it('non-GM sees only tokens they own (by owner_user_id)', () => {
    chatModeSignal.value = 'say';
    const ui = mkUi({
      isGM: false,
      myUserId: '@me:hs',
      tokens: [
        ['t-own', { id: 't-own', name: 'My Rogue', owner_user_id: '@me:hs' }],
        ['t-other', { id: 't-other', name: 'GM Villain', owner_user_id: '@gm:hs' }],
      ],
    });
    const { container } = render(h(DiceBar, { ui }));
    const select = container.querySelector('#speak-as-select');
    expect(select).not.toBeNull();
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toContain('Speak as yourself');
    expect(optionLabels).toContain('My Rogue');
    expect(optionLabels).not.toContain('GM Villain');
  });

  it('non-GM sees tokens whose underlying character they have claimed', () => {
    chatModeSignal.value = 'say';
    const ui = mkUi({
      isGM: false,
      myUserId: '@me:hs',
      tokens: [
        ['t-aria', { id: 't-aria', name: 'Aria', sheet_id: 'pc-aria' }],
      ],
      characters: new Map([
        ['pc-aria', { id: 'pc-aria', claimed_by_user_id: '@me:hs' }],
      ]),
    });
    const { container } = render(h(DiceBar, { ui }));
    const select = container.querySelector('#speak-as-select');
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toContain('Aria');
  });

  it('non-GM with no claimed characters has no persona dropdown at all', () => {
    chatModeSignal.value = 'say';
    const ui = mkUi({
      isGM: false,
      myUserId: '@me:hs',
      tokens: [
        ['t-other', { id: 't-other', name: 'GM Villain', owner_user_id: '@gm:hs' }],
      ],
    });
    const { container } = render(h(DiceBar, { ui }));
    expect(container.querySelector('#speak-as-select')).toBeNull();
  });

  it('GM sees every token in the dropdown', () => {
    chatModeSignal.value = 'say';
    const ui = mkUi({
      isGM: true,
      myUserId: '@gm:hs',
      tokens: [
        ['t-a', { id: 't-a', name: 'Aria' }],
        ['t-b', { id: 't-b', name: 'Goblin', owner_user_id: '@other:hs' }],
      ],
    });
    const { container } = render(h(DiceBar, { ui }));
    const optionLabels = Array.from(
      container.querySelectorAll('#speak-as-select option')
    ).map((o) => o.textContent);
    expect(optionLabels).toContain('Aria');
    expect(optionLabels).toContain('Goblin');
  });

  it('OOC mode hides the persona dropdown entirely (you are always yourself in OOC)', () => {
    chatModeSignal.value = 'ooc';
    const ui = mkUi({
      isGM: true,
      myUserId: '@gm:hs',
      tokens: [['t-a', { id: 't-a', name: 'Aria' }]],
    });
    const { container } = render(h(DiceBar, { ui }));
    expect(container.querySelector('#speak-as-select')).toBeNull();
  });
});
