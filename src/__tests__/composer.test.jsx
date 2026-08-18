/**
 * Composer - chat cluster for the new chat-shell.
 *
 * Extracted from DiceBar's ChatCluster. Owns:
 *   - scene banner + reply chip
 *   - mode pills (Say / Describe / OOC)
 *   - tone pill (Say only)
 *   - persona select (filtered for non-GMs)
 *   - +Scene start button
 *   - textarea (with auto-grow + per-room draft restore)
 *   - long-post modal button
 *   - send button
 *
 * Behavior parity with DiceBar's ChatCluster - same signals, same
 * helpers (chat-composer-helpers.js), same UX. The old DiceBar version
 * keeps working until the new shell retires the old one.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { Composer } from '../ui/Composer.jsx';
import {
  chatModeSignal, chatToneSignal, replyContextSignal, activeSceneSignal,
  speakAsSignal,
} from '../state/ui-signals.js';
import { tokensSignal, charactersSignal, settingsSignal } from '../state/signals.js';

function makeUi(opts = {}) {
  const sendChatMessage = vi.fn();
  const setSpeakAs = vi.fn();
  return {
    sendChatMessage,
    setSpeakAs,
    state: {
      isGM: () => opts.isGM ?? true,
      tokens: opts.tokens ?? new Map(),
      characters: opts.characters ?? new Map(),
      settings: { systemConfig: {} },
      widgetManager: { userId: '@me:m', roomId: '!r:m' },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', isAppClient: true },
  };
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  chatToneSignal.value = null;
  replyContextSignal.value = null;
  activeSceneSignal.value = null;
  speakAsSignal.value = '';
  tokensSignal.value = new Map();
  charactersSignal.value = new Map();
  settingsSignal.value = { systemConfig: {} };
  try { sessionStorage.clear(); } catch { /* private mode */ }
});

afterEach(cleanup);

describe('Composer - textarea + send', () => {
  it('renders a textarea and a send button', () => {
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('textarea[id="chat-input"]')).not.toBeNull();
    expect(container.querySelector('[data-composer-send]')).not.toBeNull();
  });

  it('clicking send fires ui.sendChatMessage with the textarea value', () => {
    const ui = makeUi();
    const { container } = render(h(Composer, { ui }));
    const ta = container.querySelector('textarea[id="chat-input"]');
    ta.value = 'hello';
    fireEvent.click(container.querySelector('[data-composer-send]'));
    expect(ui.sendChatMessage).toHaveBeenCalledWith('hello');
  });

  it('Enter sends; Shift+Enter does not', () => {
    const ui = makeUi();
    const { container } = render(h(Composer, { ui }));
    const ta = container.querySelector('textarea[id="chat-input"]');
    ta.value = 'one';
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(ui.sendChatMessage).toHaveBeenCalledTimes(1);
    ta.value = 'two';
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(ui.sendChatMessage).toHaveBeenCalledTimes(1); // still 1
  });

  it('empty / whitespace-only sends are no-ops', () => {
    const ui = makeUi();
    const { container } = render(h(Composer, { ui }));
    const ta = container.querySelector('textarea[id="chat-input"]');
    ta.value = '   ';
    fireEvent.click(container.querySelector('[data-composer-send]'));
    expect(ui.sendChatMessage).not.toHaveBeenCalled();
  });

  it('restores the per-room draft on mount', () => {
    sessionStorage.setItem('vtt:chat-draft:!r:m', 'leftover draft');
    const { container } = render(h(Composer, { ui: makeUi() }));
    const ta = container.querySelector('textarea[id="chat-input"]');
    expect(ta.value).toBe('leftover draft');
  });
});

describe('Composer - chip stack visibility', () => {
  it('chip stack hidden by default (composer unfocused, default mode, no scene)', () => {
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('[data-chat-mode="say"]')).toBeNull();
  });

  it('chip stack visible when composer is focused', () => {
    const { container } = render(h(Composer, { ui: makeUi() }));
    const ta = container.querySelector('textarea[id="chat-input"]');
    fireEvent.focus(ta);
    expect(container.querySelector('[data-chat-mode="say"]')).not.toBeNull();
  });

  it('chip stack visible when an OOC-mode message is being composed', () => {
    chatModeSignal.value = 'ooc';
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('[data-chat-mode="ooc"]')).not.toBeNull();
  });

  it('chip stack visible when a reply context is set', () => {
    replyContextSignal.value = { rootEventId: 'e1', rootSender: 'X', rootPreview: 'hi' };
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('[data-chat-mode="say"]')).not.toBeNull();
  });
});

describe('Composer - mode pills', () => {
  it('clicking the Describe pill flips chatModeSignal', () => {
    const { container } = render(h(Composer, { ui: makeUi() }));
    fireEvent.focus(container.querySelector('textarea[id="chat-input"]'));
    fireEvent.click(container.querySelector('[data-chat-mode="describe"]'));
    expect(chatModeSignal.value).toBe('describe');
  });

  it('clicking the OOC pill flips chatModeSignal', () => {
    const { container } = render(h(Composer, { ui: makeUi() }));
    fireEvent.focus(container.querySelector('textarea[id="chat-input"]'));
    fireEvent.click(container.querySelector('[data-chat-mode="ooc"]'));
    expect(chatModeSignal.value).toBe('ooc');
  });
});

describe('Composer - persona dropdown', () => {
  it('renders persona select when GM has any tokens', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Bartender' }]]);
    const { container } = render(h(Composer, { ui: makeUi({ tokens }) }));
    const sel = container.querySelector('select#speak-as-select');
    expect(sel).not.toBeNull();
    const opts = Array.from(sel.querySelectorAll('option')).map((o) => o.textContent);
    expect(opts).toContain('Bartender');
  });

  it('hides persona select in OOC mode', () => {
    chatModeSignal.value = 'ooc';
    const tokens = new Map([['t1', { id: 't1', name: 'Bartender' }]]);
    const { container } = render(h(Composer, { ui: makeUi({ tokens }) }));
    expect(container.querySelector('select#speak-as-select')).toBeNull();
  });

  it('non-GM with no owned tokens sees no persona select', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Bartender', owner_user_id: '@gm:m' }]]);
    const { container } = render(h(Composer, { ui: makeUi({ isGM: false, tokens }) }));
    expect(container.querySelector('select#speak-as-select')).toBeNull();
  });
});

describe('Composer - scene banner + reply chip', () => {
  it('renders the scene banner when a scene is active', () => {
    activeSceneSignal.value = { eventId: 'e1', title: 'The Docks' };
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('.scene-banner')).not.toBeNull();
    expect(container.textContent).toContain('The Docks');
  });

  it('renders the reply chip when a reply context is set', () => {
    replyContextSignal.value = { rootEventId: 'e1', rootSender: 'Sarah', rootPreview: 'hush' };
    const { container } = render(h(Composer, { ui: makeUi() }));
    expect(container.querySelector('.reply-context-chip')).not.toBeNull();
    expect(container.textContent).toContain('Sarah');
  });
});
