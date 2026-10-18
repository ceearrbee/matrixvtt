/**
 * Every control that implies privacy says plainly that the room can read
 * it: whispers, private and GM-visible pages, and the campaign setup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';
import { sendChatMessage } from '../ui/chat-send.js';
import { showPageForm } from '../ui/pages-panel.js';
import { createMinimalUI } from '../ui/ui-methods.js';
import {
  chatModeSignal, chatToneSignal, activeSceneSignal, replyContextSignal, speakAsSignal,
} from '../state/ui-signals.js';
import { tokensSignal, charactersSignal } from '../state/signals.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class { constructor() {} render() {} destroy() {} },
}));

beforeEach(() => {
  chatModeSignal.value = 'say';
  chatToneSignal.value = null;
  activeSceneSignal.value = null;
  replyContextSignal.value = null;
  speakAsSignal.value = '';
  tokensSignal.value = new Map();
  charactersSignal.value = new Map();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('whispers', () => {
  it('the composer hint says a whisper is not private', () => {
    const ui = {
      state: {
        isGM: () => false, tokens: new Map(), characters: new Map(),
        settings: { systemConfig: { rolls: {} } }, widgetManager: { roomId: '!r:hs' },
      },
      widgetManager: { userId: '@me:hs', isAppClient: true },
      _latestDiceResult: '',
      sendChatMessage: vi.fn(),
      setSpeakAs: vi.fn(),
      rollDice: vi.fn(),
    };
    const { container } = render(h(DiceBar, { ui }));
    expect(container.querySelector('#chat-input').getAttribute('placeholder')).toMatch(/whisper \(not private\)/i);
  });

  it('the sender’s own log line says the whisper is not private', async () => {
    const sendRoomEvent = vi.fn().mockResolvedValue({ event_id: '$e:m' });
    const ui = {
      widgetManager: { userId: '@me:m', sendRoomEvent },
      state: { tokens: new Map(), isGM: () => true, sendRoomEvent },
      _findTokenForSender: () => null,
      _log: vi.fn(),
      rollMacro: vi.fn(),
      mapRenderer: null,
    };
    await sendChatMessage(ui, '/w @bob:m meet me at the docks');
    const [, html] = ui._log.mock.calls.at(-1);
    expect(html).toMatch(/not private/i);
  });
});

describe('page visibility', () => {
  it('says a private or GM-visible page is still readable by the room', async () => {
    const ui = {
      state: { pages: new Map(), widgetManager: { userId: '@gm:hs' }, isGM: () => true },
      widgetManager: { userId: '@gm:hs' },
    };
    await showPageForm(ui);
    const hint = document.getElementById('page-visibility-hint');
    expect(hint).not.toBeNull();
    expect(document.getElementById('page-visibility').getAttribute('aria-describedby')).toBe('page-visibility-hint');
    expect(hint.textContent).toMatch(/everyone in this room can still read/i);
  });
});

describe('campaign setup', () => {
  it('the wizard says everyone in the room can read the campaign', async () => {
    const state = {
      tokens: new Map(), characters: new Map(), npcs: new Map(),
      items: new Map(), handouts: new Map(), tables: new Map(), maps: new Map(),
      settings: { systemConfig: null },
      constructor: { getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }) },
    };
    const widgetManager = {
      userIdResolved: true, isAppClient: true,
      canEditRoomState: vi.fn().mockResolvedValue(true),
    };
    const ui = createMinimalUI(state, widgetManager, null);
    await ui.showFirstTimeSetup({ bypassAuthCheck: true });
    expect(document.getElementById('setup-wizard').textContent).toMatch(/treat this room as public/i);
  });
});
