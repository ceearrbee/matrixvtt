/**
 * Slash commands end-to-end through sendChatMessage.
 *
 * Companion to slashCommands.test.js (which covers the parser in
 * isolation). This pins the integration: chat-send.js translates
 * each parsed slash result into the right wire content + local-echo
 * shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage } from '../ui/chat-send.js';
import { EVENT_TYPES } from '../utils/constants.js';
import {
  speakAsSignal, chatModeSignal, chatToneSignal,
  replyContextSignal, activeSceneSignal,
} from '../state/ui-signals.js';

function makeUi() {
  const sendRoomEvent = vi.fn().mockResolvedValue({ event_id: '$evt:m' });
  return {
    widgetManager: { userId: '@me:m', sendRoomEvent },
    state: {
      tokens: new Map(),
      isGM: () => true,
      sendRoomEvent,
    },
    _findTokenForSender: () => null,
    _log: vi.fn(),
    rollMacro: vi.fn(),
    mapRenderer: null,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  chatModeSignal.value = 'say';
  chatToneSignal.value = null;
  speakAsSignal.value = '';
  replyContextSignal.value = null;
  activeSceneSignal.value = null;
});

describe('sendChatMessage - /roll', () => {
  it('dispatches to ui.rollMacro and does NOT send a chat message', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/roll 1d20+3');
    expect(ui.rollMacro).toHaveBeenCalledWith('1d20+3');
    expect(ui.state.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('accepts /r as an alias for /roll', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/r 2d6+1');
    expect(ui.rollMacro).toHaveBeenCalledWith('2d6+1');
    expect(ui.state.sendRoomEvent).not.toHaveBeenCalled();
  });
});

describe('sendChatMessage - /as (one-shot say persona)', () => {
  it('sends m.text prefixed with the override name', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/as Bartender Welcome, traveller.');
    const call = ui.state.sendRoomEvent.mock.calls[0];
    expect(call[0]).toBe(EVENT_TYPES.ROOM_MESSAGE);
    expect(call[1].msgtype).toBe('m.text');
    expect(call[1].body).toBe('Bartender: Welcome, traveller.');
  });

  it('does NOT attach the SPEAK_AS_TOKEN custom field (no persistent token)', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/as Bartender hi');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBeUndefined();
  });

  it('uses the override name in the local-echo display, not the user matrix id', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/as Bartender hi');
    // _log is called with (icon, body) where body contains the displayName.
    const logCall = ui._log.mock.calls[0];
    expect(logCall[1]).toContain('Bartender');
    expect(logCall[1]).not.toContain('@me');
  });

  it('quoted persona name with internal whitespace', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/as "Old Knight" The road is dark.');
    const body = ui.state.sendRoomEvent.mock.calls[0][1].body;
    expect(body).toBe('Old Knight: The road is dark.');
  });

  it('chatModeSignal is NOT mutated by /as (one-shot semantics)', async () => {
    chatModeSignal.value = 'describe';
    const ui = makeUi();
    await sendChatMessage(ui, '/as Bartender hi');
    expect(chatModeSignal.value).toBe('describe');
  });
});

describe('sendChatMessage - /asd (one-shot describe persona)', () => {
  it('sends m.emote with the override name', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/asd Bartender bows behind the counter.');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content.msgtype).toBe('m.emote');
    expect(content.body).toBe('Bartender bows behind the counter.');
  });

  it('does NOT attach the SPEAK_AS_TOKEN custom field', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '/asd Bartender bows.');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBeUndefined();
  });

  it('persistent persona (speakAsSignal) is ignored when /asd provides an override', async () => {
    speakAsSignal.value = 'tok-aria';
    const ui = makeUi();
    ui.state.tokens.set('tok-aria', { id: 'tok-aria', name: 'Aria' });
    await sendChatMessage(ui, '/asd Bartender bows.');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBeUndefined();
    expect(content.body).toBe('Bartender bows.');
    expect(content.body).not.toContain('Aria');
  });
});

describe('sendChatMessage - plain (no slash regression)', () => {
  it('a plain message still sends as m.text with no persona prefix', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, 'just a chat');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content.msgtype).toBe('m.text');
    expect(content.body).toBe('just a chat');
  });

  it('persistent persona via speakAsSignal still prefixes the body for plain messages', async () => {
    speakAsSignal.value = 'tok-aria';
    const ui = makeUi();
    ui.state.tokens.set('tok-aria', { id: 'tok-aria', name: 'Aria' });
    await sendChatMessage(ui, 'hello');
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content.body).toBe('Aria: hello');
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBe('tok-aria');
  });
});
