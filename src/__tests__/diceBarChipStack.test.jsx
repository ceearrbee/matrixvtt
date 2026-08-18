/**
 * Chat-cluster chips (mode pills,
 * tone, persona, +Scene) are hidden by default. They appear when the
 * composer has focus, or when the room is in a scene/reply/non-default
 * mode that warrants the secondary controls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';
import { chatModeSignal, activeSceneSignal, replyContextSignal } from '../state/ui-signals.js';

function mkUi() {
  return {
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
  };
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  activeSceneSignal.value = null;
  replyContextSignal.value = null;
});

describe('DiceBar - chip stack (Phase 6)', () => {
  it('chips are hidden when the composer is unfocused and no scene/reply is active', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    expect(container.querySelector('.chat-mode-pills, [data-chat-mode]')).toBeNull();
    expect(container.querySelector('.scene-start-btn')).toBeNull();
  });

  it('focusing the composer reveals the chip stack', () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    const composer = container.querySelector('#chat-input');
    fireEvent.focus(composer);
    expect(container.querySelector('.scene-start-btn')).not.toBeNull();
  });

  it('an active scene renders the scene banner but does NOT auto-reveal the mode pills', () => {
    activeSceneSignal.value = { eventId: '$s', title: 'The Crypt' };
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    // Composer cohesion pass: the scene-active condition stopped
    // force-revealing the chip stack. The scene banner still renders
    // (it's independent of the chip stack) so the user can see /
    // leave the scene at a glance, but Say/Describe/OOC only surface
    // on composer focus or explicit non-default mode.
    expect(container.querySelector('.scene-banner')).not.toBeNull();
    expect(container.querySelector('[data-chat-mode]')).toBeNull();
  });

  it('blurring the composer hides the chip stack again (after the blur-defer tick)', async () => {
    const { container } = render(h(DiceBar, { ui: mkUi() }));
    const composer = container.querySelector('#chat-input');
    fireEvent.focus(composer);
    expect(container.querySelector('.scene-start-btn')).not.toBeNull();
    fireEvent.blur(composer);
    // Blur is deferred a tick so in-flight chip clicks can land.
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('.scene-start-btn')).toBeNull();
  });
});
