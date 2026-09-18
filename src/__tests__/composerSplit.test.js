/**
 * DiceBar.jsx carried three clusters, and one of them was not a dice
 * feature: the chat composer sat in that file because both happen to
 * occupy one row. The composer leaves, the dice stay.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ChatCluster } from '../ui/composer/ChatCluster.jsx';
import { DiceBar } from '../ui/DiceBar.jsx';
import { chatModeSignal, activeSceneSignal, replyContextSignal } from '../state/ui-signals.js';

const read = (rel) => readFileSync(resolve(import.meta.dirname, '../../', rel), 'utf8');

function mkUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      tokens: new Map(),
      characters: new Map(),
      settings: { systemConfig: { rolls: {} } },
      widgetManager: { roomId: '!r:s' },
    },
    widgetManager: { userId: '@me:hs', isAppClient: true },
    _latestDiceResult: '',
    sendChatMessage: vi.fn(),
    setSpeakAs: vi.fn(),
    rollDice: vi.fn(),
  });
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  activeSceneSignal.value = null;
  replyContextSignal.value = null;
});

describe('the chat composer is its own module', () => {
  it('renders the input and Send on its own, with no dice bar around it', () => {
    const { container } = render(h(ChatCluster, { ui: mkUi(), isGM: true }));
    expect(container.querySelector('#chat-input')).not.toBeNull();
    expect(container.querySelector('#chat-send')).not.toBeNull();
    expect(container.querySelector('[data-dice]')).toBeNull();
  });

  it('sends what was typed', () => {
    const ui = mkUi();
    const { container } = render(h(ChatCluster, { ui, isGM: true }));
    const input = container.querySelector('#chat-input');
    input.value = 'hello table';
    container.querySelector('#chat-send').click();
    expect(ui.sendChatMessage).toHaveBeenCalledWith('hello table');
    expect(input.value).toBe('');
  });
});

describe('DiceBar keeps the dice', () => {
  it('no longer declares the composer itself', () => {
    const src = read('src/ui/DiceBar.jsx');
    expect(src).not.toMatch(/chat-input/);
    expect(src).not.toMatch(/speak-as/);
    expect(src).not.toMatch(/ChatTonePicker/);
    expect(src.split('\n').length).toBeLessThan(200);
  });

  it('still mounts the composer inside the bar', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    expect(container.querySelector('#chat-input')).not.toBeNull();
    expect(container.querySelector('[data-dice-strip-toggle]')).not.toBeNull();
  });
});
