/**
 * Wire-format pin: when a persona is selected, the outgoing body must
 * carry the persona prefix so non-VTT Matrix clients (Element, etc.)
 * see "Sora: …" instead of just the actual sender.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage } from '../ui/ui-lifecycle.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { speakAsSignal, chatModeSignal, chatToneSignal } from '../state/ui-signals.js';

function makeUi({ speakAs = '', personaName = null } = {}) {
  speakAsSignal.value = speakAs;
  const sendRoomEvent = vi.fn().mockResolvedValue(undefined);
  const tokens = new Map();
  if (speakAs && personaName) {
    tokens.set(speakAs, { id: speakAs, name: personaName });
  }
  return {
    widgetManager: { userId: '@me:server', sendRoomEvent },
    state: { tokens, isGM: () => true, sendRoomEvent },
    _findTokenForSender: () => null,
    _log: vi.fn(),
    _installDom() {
      const input = document.createElement('input');
      input.id = 'chat-input';
      document.body.appendChild(input);
    },
  };
}

describe('persona prefix in outgoing body', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    chatModeSignal.value = 'say';
    chatToneSignal.value = null;
  });

  it('Say with persona "Sora": body becomes `Sora: hi`', async () => {
    const ui = makeUi({ speakAs: 'tok-sora', personaName: 'Sora' });
    ui._installDom();
    await sendChatMessage(ui, 'hi');
    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.body).toBe('Sora: hi');
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBe('tok-sora');
  });

  it('Say with persona + tone: body becomes `Sora: [Cheerful] hi`', async () => {
    chatToneSignal.value = { name: 'Cheerful' };
    const ui = makeUi({ speakAs: 'tok-sora', personaName: 'Sora' });
    ui._installDom();
    await sendChatMessage(ui, 'hi');
    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.body).toBe('Sora: [Cheerful] hi');
  });

  it('Describe with persona: body becomes `Sora leans against the wall`', async () => {
    chatModeSignal.value = 'describe';
    const ui = makeUi({ speakAs: 'tok-sora', personaName: 'Sora' });
    ui._installDom();
    await sendChatMessage(ui, 'leans against the wall');
    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.msgtype).toBe('m.emote');
    expect(content.body).toBe('Sora leans against the wall');
  });

  it('Say without persona: body unchanged', async () => {
    const ui = makeUi();
    ui._installDom();
    await sendChatMessage(ui, 'hi');
    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.body).toBe('hi');
  });

  it('Whisper with persona: body stays clean (no persona prefix in whispers)', async () => {
    const ui = makeUi({ speakAs: 'tok-sora', personaName: 'Sora' });
    ui._installDom();
    await sendChatMessage(ui, '/w @ally:hs psst');
    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content.body).toBe('psst');
    expect(content.whisper_to).toBe('@ally:hs');
  });
});
