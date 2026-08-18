/**
 * Inbound chat: timeline-intake must forward m.emote and m.notice events
 * to the CHAT_MESSAGE listener so the log can render them as Describe /
 * OOC entries. Previously only m.text passed the filter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTimelineEvent } from '../chat/timeline-intake.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

function makeChat(myUserId = '@me:hs') {
  return {
    clientManager: { userId: myUserId },
    state: { tokens: new Map(), characters: new Map(), npcs: new Map() },
    diceRoller: { roll: () => ({ result: 0, rolls: [], formula: '' }) },
    announcements: { damage: true, combat: true, mapChanges: true, hideGMActions: false },
  };
}

describe('timeline-intake - m.emote / m.notice forwarding', () => {
  let listener;
  beforeEach(() => {
    listener = vi.fn();
    window.addEventListener(VTT_EVENTS.CHAT_MESSAGE, listener);
  });
  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.CHAT_MESSAGE, listener);
  });

  it('forwards m.emote events with msgtype in the payload', async () => {
    const chat = makeChat();
    await handleTimelineEvent(chat, {
      type: EVENT_TYPES.ROOM_MESSAGE,
      sender: '@friend:hs',
      event_id: '$1',
      content: { msgtype: 'm.emote', body: 'leans against the wall' },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      sender: '@friend:hs',
      body: 'leans against the wall',
      msgtype: 'm.emote',
    });
  });

  it('forwards m.notice events with msgtype in the payload', async () => {
    const chat = makeChat();
    await handleTimelineEvent(chat, {
      type: EVENT_TYPES.ROOM_MESSAGE,
      sender: '@friend:hs',
      event_id: '$2',
      content: { msgtype: 'm.notice', body: 'pizza in 5' },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      sender: '@friend:hs',
      body: 'pizza in 5',
      msgtype: 'm.notice',
    });
  });

  it('forwards com.vtt.tone metadata when present', async () => {
    const chat = makeChat();
    await handleTimelineEvent(chat, {
      type: EVENT_TYPES.ROOM_MESSAGE,
      sender: '@friend:hs',
      event_id: '$3',
      content: {
        msgtype: 'm.text',
        body: '[Cheerful] hi',
        [EVENT_TYPES.TONE]: { name: 'Cheerful', color: '#f0c060' },
      },
    });
    expect(listener.mock.calls[0][0].detail.tone).toEqual({ name: 'Cheerful', color: '#f0c060' });
  });

  it('ignores unknown msgtypes (e.g. m.image)', async () => {
    const chat = makeChat();
    await handleTimelineEvent(chat, {
      type: EVENT_TYPES.ROOM_MESSAGE,
      sender: '@friend:hs',
      event_id: '$4',
      content: { msgtype: 'm.image', body: 'pic.png', url: 'mxc://x/y' },
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
