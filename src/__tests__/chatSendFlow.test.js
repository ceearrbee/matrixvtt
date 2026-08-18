/**
 * N - Chat verification.
 *
 * Chat stays Matrix-native: outgoing messages go to the room via
 * `widgetManager.sendRoomEvent('m.room.message', …)`, and incoming
 * messages are dispatched as `vtt:chat-message` for the log panel.
 * No in-app chat panel, no reactions UI.
 *
 * This test pins the send-side contract: plain text, whispers, and
 * speak-as-token all reach the room with the right content shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage } from '../ui/ui-lifecycle.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { speakAsSignal, chatModeSignal, chatToneSignal } from '../state/ui-signals.js';

function makeUi({ speakAs = '' } = {}) {
  speakAsSignal.value = speakAs;
  const sendRoomEvent = vi.fn().mockResolvedValue(undefined);
  return {
    widgetManager: {
      userId: '@me:server',
      sendRoomEvent,
    },
    state: {
      tokens: new Map(),
      isGM: () => true,
      sendRoomEvent,
    },
    _findTokenForSender: () => null,
    _log: vi.fn(),
    // Populate the DOM inputs sendChatMessage reads.
    _installDom() {
      const input = document.createElement('input');
      input.id = 'chat-input';
      document.body.appendChild(input);
    },
  };
}

describe('sendChatMessage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    chatModeSignal.value = 'say';
    chatToneSignal.value = null;
  });

  it('posts a plain m.text message to the Matrix room', async () => {
    const ui = makeUi();
    ui._installDom();

    await sendChatMessage(ui, 'Hello, party.');

    expect(ui.widgetManager.sendRoomEvent).toHaveBeenCalledOnce();
    const [eventType, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(eventType).toBe(EVENT_TYPES.ROOM_MESSAGE);
    expect(content).toMatchObject({ msgtype: 'm.text', body: 'Hello, party.' });
    expect(content.whisper_to).toBeUndefined();
  });

  it('parses /w <user> <body> into a whisper', async () => {
    const ui = makeUi();
    ui._installDom();

    await sendChatMessage(ui, '/w @ally:server psst, the lich is watching');

    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.body).toBe('psst, the lich is watching');
    expect(content.whisper_to).toBe('@ally:server');
  });

  it('attaches the speak-as-token id when one is selected', async () => {
    const ui = makeUi({ speakAs: 'tok-goblin' });
    ui._installDom();

    await sendChatMessage(ui, 'Skreeeee!');

    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBe('tok-goblin');
  });

  it('ignores blank or whitespace-only input', async () => {
    const ui = makeUi();
    ui._installDom();

    await sendChatMessage(ui, '   ');

    expect(ui.widgetManager.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('clears the input element after send', async () => {
    const ui = makeUi();
    ui._installDom();
    const input = document.getElementById('chat-input');
    input.value = 'typed';

    await sendChatMessage(ui, 'typed');

    expect(input.value).toBe('');
  });

  describe('speaking modes', () => {
    it('Describe mode sends m.emote', async () => {
      chatModeSignal.value = 'describe';
      const ui = makeUi();
      ui._installDom();
      await sendChatMessage(ui, 'leans against the wall');
      const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
      expect(content.msgtype).toBe('m.emote');
      expect(content.body).toBe('leans against the wall');
    });

    it('OOC mode sends m.notice and drops persona / tone', async () => {
      chatModeSignal.value = 'ooc';
      chatToneSignal.value = { name: 'Cheerful' };
      const ui = makeUi({ speakAs: 'tok-anyone' });
      ui._installDom();
      await sendChatMessage(ui, 'pizza in 5');
      const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
      expect(content.msgtype).toBe('m.notice');
      expect(content.body).toBe('pizza in 5');
      expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBeUndefined();
      expect(content[EVENT_TYPES.TONE]).toBeUndefined();
    });
  });

  describe('tones', () => {
    it('Say with a non-Neutral tone prefixes the body and stamps com.vtt.tone', async () => {
      chatToneSignal.value = { name: 'Cheerful', color: '#f0c060' };
      const ui = makeUi();
      ui._installDom();
      await sendChatMessage(ui, 'hi there');
      const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
      expect(content.body).toBe('[Cheerful] hi there');
      expect(content[EVENT_TYPES.TONE]).toEqual({ name: 'Cheerful', color: '#f0c060' });
    });

    it('Neutral tone is a no-op (no prefix, no tone field)', async () => {
      chatToneSignal.value = { name: 'Neutral' };
      const ui = makeUi();
      ui._installDom();
      await sendChatMessage(ui, 'plain hi');
      const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
      expect(content.body).toBe('plain hi');
      expect(content[EVENT_TYPES.TONE]).toBeUndefined();
    });

    it('Describe ignores tone (tone is Say-only)', async () => {
      chatModeSignal.value = 'describe';
      chatToneSignal.value = { name: 'Angry' };
      const ui = makeUi();
      ui._installDom();
      await sendChatMessage(ui, 'snarls');
      const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
      expect(content.body).toBe('snarls');
      expect(content[EVENT_TYPES.TONE]).toBeUndefined();
    });
  });
});
