/**
 * Chat mode pills must remain clickable from a focused composer.
 *
 * Regression: the Say / Describe / OOC pill stack is gated behind
 * `composerFocused || mode !== 'say'`. Clicking a pill caused the
 * textarea to blur *before* the click event fired, which unmounted the
 * pill and dropped the click - switching modes never worked.
 *
 * Two-layer fix:
 *   - mousedown on a pill calls preventDefault() so focus stays in
 *     the textarea (mode flips without ever losing focus).
 *   - blur out of the composer is deferred a tick so any in-flight
 *     click can still register if focus does shift.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';
import {
  chatModeSignal, chatToneSignal, activeSceneSignal,
  replyContextSignal,
} from '../state/ui-signals.js';
import {
  settingsSignal, tokensSignal, charactersSignal, npcsSignal,
} from '../state/signals.js';

function makeUi() {
  return /** @type {any} */ ({
    activityLog: [],
    state: {
      isGM: () => true,
      tokens: new Map(),
      characters: new Map(),
      npcs: new Map(),
      settings: { systemConfig: {} },
      widgetManager: { userId: '@me:m', roomId: '!r:m' },
    },
    widgetManager: {
      userId: '@me:m', roomId: '!r:m',
      isAppClient: true,
      getApi: () => null,
    },
    setSpeakAs: vi.fn(),
    rollMacro: vi.fn(),
  });
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  chatToneSignal.value = null;
  activeSceneSignal.value = null;
  replyContextSignal.value = null;
  settingsSignal.value = { systemConfig: {} };
  tokensSignal.value = new Map();
  charactersSignal.value = new Map();
  npcsSignal.value = new Map();
});
afterEach(() => { cleanup(); });

describe('Chat mode pills - focus survives a click', () => {
  it('clicking the Describe pill while composer is focused flips the mode', () => {
    const { container } = render(h(DiceBar, { ui: makeUi() }));
    const input = container.querySelector('#chat-input');
    expect(input).not.toBeNull();
    fireEvent.focus(input);
    // Pills should now be rendered (showChipStack = composerFocused).
    const describeBtn = container.querySelector('[data-chat-mode="describe"]');
    expect(describe).not.toBeNull();
    fireEvent.mouseDown(describeBtn);
    fireEvent.click(describeBtn);
    expect(chatModeSignal.value).toBe('describe');
  });

  it('clicking OOC also flips correctly', () => {
    const { container } = render(h(DiceBar, { ui: makeUi() }));
    const input = container.querySelector('#chat-input');
    fireEvent.focus(input);
    const ooc = container.querySelector('[data-chat-mode="ooc"]');
    fireEvent.mouseDown(ooc);
    fireEvent.click(ooc);
    expect(chatModeSignal.value).toBe('ooc');
  });

  it('pill mousedown is cancelable (preventDefault keeps focus on the textarea)', () => {
    const { container } = render(h(DiceBar, { ui: makeUi() }));
    const input = container.querySelector('#chat-input');
    fireEvent.focus(input);
    const describeBtn = container.querySelector('[data-chat-mode="describe"]');
    // Dispatch a real MouseEvent so we can read defaultPrevented after.
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    describeBtn.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
