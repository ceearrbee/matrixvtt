/**
 * Whisper - private out-of-character chat. Backed by a com.vtt.whisper
 * timeline event with a `to: [mxid, ...]` recipient list. The
 * receiver-side filter shows it only when the local user is the
 * sender or in the `to` list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTimelineEvent } from '../chat/timeline-intake.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

function makeChat({ userId = '@me:hs' } = {}) {
  return {
    clientManager: { userId, sendRoomEvent: vi.fn(async () => {}) },
    state: {},
  };
}

let chatEvents;
let onChat;
beforeEach(() => {
  chatEvents = [];
  onChat = (e) => chatEvents.push(e.detail);
  window.addEventListener(VTT_EVENTS.CHAT_MESSAGE, onChat);
});

describe('whisper inbound', () => {
  it('emits CHAT_MESSAGE for the recipient', () => {
    const chat = makeChat({ userId: '@target:hs' });
    handleTimelineEvent(chat, {
      type: EVENT_TYPES.WHISPER,
      sender: '@gm:hs',
      content: { to: ['@target:hs'], body: 'pst, watch out' },
    });
    expect(chatEvents).toHaveLength(1);
    expect(chatEvents[0].body).toBe('pst, watch out');
    expect(chatEvents[0].isWhisper).toBe(true);
    expect(chatEvents[0].whisperTo).toEqual(['@target:hs']);
  });

  it('does NOT emit for users outside the to-list', () => {
    const chat = makeChat({ userId: '@bystander:hs' });
    handleTimelineEvent(chat, {
      type: EVENT_TYPES.WHISPER,
      sender: '@gm:hs',
      content: { to: ['@target:hs'], body: 'private' },
    });
    expect(chatEvents).toHaveLength(0);
  });

  it('does NOT emit a duplicate for the sender (local echo)', () => {
    const chat = makeChat({ userId: '@gm:hs' });
    handleTimelineEvent(chat, {
      type: EVENT_TYPES.WHISPER,
      sender: '@gm:hs',
      content: { to: ['@target:hs'], body: 'private' },
    });
    expect(chatEvents).toHaveLength(0);
  });

  it('treats missing or empty to-list as nobody (no emit)', () => {
    const chat = makeChat({ userId: '@me:hs' });
    handleTimelineEvent(chat, {
      type: EVENT_TYPES.WHISPER,
      sender: '@gm:hs',
      content: { body: 'oops, no recipients' },
    });
    expect(chatEvents).toHaveLength(0);
  });
});

describe('ChatIntegrator.sendWhisper', () => {
  function makeState() {
    return { sendRoomEvent: vi.fn(async () => {}) };
  }

  it('writes a com.vtt.whisper event with to + body + ts', async () => {
    const { ChatIntegrator } = await import('../chat-integrator.js');
    const state = makeState();
    const ci = new ChatIntegrator(makeChat().clientManager, state);
    await ci.sendWhisper(['@a:hs', '@b:hs'], 'group whisper');
    const calls = state.sendRoomEvent.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(EVENT_TYPES.WHISPER);
    expect(calls[0][1].to).toEqual(['@a:hs', '@b:hs']);
    expect(calls[0][1].body).toBe('group whisper');
    expect(typeof calls[0][1].ts).toBe('number');
  });

  it('drops empty / nullish bodies', async () => {
    const { ChatIntegrator } = await import('../chat-integrator.js');
    const state = makeState();
    const ci = new ChatIntegrator(makeChat().clientManager, state);
    await ci.sendWhisper(['@a:hs'], '   ');
    await ci.sendWhisper(['@a:hs'], null);
    await ci.sendWhisper(['@a:hs'], '');
    expect(state.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('drops empty recipient lists', async () => {
    const { ChatIntegrator } = await import('../chat-integrator.js');
    const ci = new ChatIntegrator(makeChat().clientManager, {});
    await ci.sendWhisper([], 'hello');
    expect(ci.clientManager.sendRoomEvent).not.toHaveBeenCalled();
  });
});
