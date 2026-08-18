import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendChatMessage, hasMarkdown } from '../ui/chat-send.js';
import {
  speakAsSignal, replyContextSignal, chatModeSignal, chatToneSignal,
  activeSceneSignal,
} from '../state/ui-signals.js';

function makeUi() {
  const sent = [];
  const sendRoomEvent = vi.fn(async (type, content) => {
    const id = `$ev_${sent.length}`;
    sent.push({ type, content, event_id: id });
    return { event_id: id };
  });
  const ui = {
    state: {
      sendRoomEvent,
      tokens: new Map(),
      widgetManager: { roomId: '!r:s', userId: '@me:s' },
    },
    widgetManager: { userId: '@me:s' },
    activityLog: [],
    _seenLogEventIds: new Set(),
    _log: (icon, html, opts) => ui.activityLog.unshift({ icon, html, ...opts }),
    _findTokenForSender: () => null,
    mapRenderer: { showSpeechBubble: vi.fn() },
    _sent: sent,
  };
  return ui;
}

describe('hasMarkdown', () => {
  it('detects markdown-significant characters', () => {
    expect(hasMarkdown('hello')).toBe(false);
    expect(hasMarkdown('**bold**')).toBe(true);
    expect(hasMarkdown('a list\n- item')).toBe(true);
    expect(hasMarkdown('> quote')).toBe(true);
    expect(hasMarkdown('`code`')).toBe(true);
    expect(hasMarkdown('see [link](x)')).toBe(true);
  });
});

describe('sendChatMessage - formatted_body', () => {
  beforeEach(() => {
    speakAsSignal.value = '';
    replyContextSignal.value = null;
    chatModeSignal.value = 'say';
    chatToneSignal.value = null;
    activeSceneSignal.value = null;
  });

  it('plain text does NOT get formatted_body', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, 'hello');
    expect(ui._sent[0].content.format).toBeUndefined();
    expect(ui._sent[0].content.formatted_body).toBeUndefined();
  });

  it('markdown gets format + formatted_body', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, '**bold** and *italic*');
    const c = ui._sent[0].content;
    expect(c.format).toBe('org.matrix.custom.html');
    expect(c.formatted_body).toContain('<strong>bold</strong>');
    expect(c.formatted_body).toContain('<em>italic</em>');
    expect(c.body).toBe('**bold** and *italic*');
  });
});

describe('sendChatMessage - scene threading', () => {
  beforeEach(() => {
    speakAsSignal.value = '';
    replyContextSignal.value = null;
    chatModeSignal.value = 'say';
    chatToneSignal.value = null;
    activeSceneSignal.value = null;
  });

  it('attaches m.thread to the active scene root', async () => {
    activeSceneSignal.value = { eventId: '$scene-root', title: 'X' };
    const ui = makeUi();
    await sendChatMessage(ui, 'In-scene line');
    expect(ui._sent[0].content['m.relates_to']).toEqual({
      rel_type: 'm.thread',
      event_id: '$scene-root',
      is_falling_back: true,
    });
  });

  it('reply context overrides the scene root', async () => {
    activeSceneSignal.value = { eventId: '$scene-root', title: 'X' };
    replyContextSignal.value = {
      rootEventId: '$another-thread',
      rootSender: '@b:s',
      rootPreview: '…',
    };
    const ui = makeUi();
    await sendChatMessage(ui, 'reply');
    expect(ui._sent[0].content['m.relates_to'].event_id).toBe('$another-thread');
  });

  it('whisper always escapes the active scene (no m.relates_to)', async () => {
    activeSceneSignal.value = { eventId: '$scene-root', title: 'X' };
    const ui = makeUi();
    await sendChatMessage(ui, '/w @alice:server psst');
    const c = ui._sent[0].content;
    expect(c.whisper_to).toBe('@alice:server');
    expect(c['m.relates_to']).toBeUndefined();
  });

  it('no scene + no reply = no m.relates_to', async () => {
    const ui = makeUi();
    await sendChatMessage(ui, 'plain');
    expect(ui._sent[0].content['m.relates_to']).toBeUndefined();
  });
});
