/**
 * timeline-intake - own historical messages must NOT be filtered out.
 *
 * `_handleRoomMessage` originally skipped the CHAT_MESSAGE dispatch
 * whenever `sender === myUserId`, on the assumption that the local
 * echo on send already showed the user their own message. That's
 * true for LIVE outgoing messages, but on a page reload the live
 * echo is gone - the room's historical timeline replays the user's
 * own scenes/messages with `_historical: true`. Filtering them out
 * meant a GM's own scene-root events never reached the activityLog,
 * so the IconRail ScenesDrawer stayed empty.
 *
 * Fix: only skip own messages when they're LIVE (not historical).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VTT_EVENTS } from '../utils/constants.js';
import { handleTimelineEvent } from '../chat/timeline-intake.js';

function makeChat(myUserId) {
  return /** @type {any} */ ({
    clientManager: { userId: myUserId },
    state: { recordDamage: vi.fn() },
  });
}

let dispatched;
let listener;

beforeEach(() => {
  dispatched = [];
  listener = (e) => dispatched.push(e.detail);
  window.addEventListener(VTT_EVENTS.CHAT_MESSAGE, listener);
});
afterEach(() => {
  window.removeEventListener(VTT_EVENTS.CHAT_MESSAGE, listener);
});

describe('handleTimelineEvent - own historical messages', () => {
  it('dispatches CHAT_MESSAGE for own scene-root posted in a previous session', async () => {
    const chat = makeChat('@gm:m');
    await handleTimelineEvent(chat, {
      type: 'm.room.message',
      sender: '@gm:m',
      event_id: '$scene1',
      content: {
        msgtype: 'm.text',
        body: '🎬 Session 3 - Smoke on the Horizon\n\nThe party stacks…',
        'com.vtt.scene_root': true,
        'com.vtt.scene_title': 'Session 3 - Smoke on the Horizon',
      },
      _historical: true,
    });
    expect(dispatched.length).toBe(1);
    expect(dispatched[0].isSceneRoot).toBe(true);
    expect(dispatched[0].sceneTitle).toBe('Session 3 - Smoke on the Horizon');
    expect(dispatched[0].historical).toBe(true);
  });

  it('still skips own LIVE messages (the original double-log guard)', async () => {
    const chat = makeChat('@gm:m');
    await handleTimelineEvent(chat, {
      type: 'm.room.message',
      sender: '@gm:m',
      event_id: '$live1',
      content: { msgtype: 'm.text', body: 'hello' },
      _historical: false,
    });
    expect(dispatched.length).toBe(0);
  });

  it('dispatches CHAT_MESSAGE for foreign messages regardless of historical flag', async () => {
    const chat = makeChat('@gm:m');
    await handleTimelineEvent(chat, {
      type: 'm.room.message',
      sender: '@player:m',
      event_id: '$foreign',
      content: { msgtype: 'm.text', body: 'hark' },
      _historical: true,
    });
    expect(dispatched.length).toBe(1);
    expect(dispatched[0].sender).toBe('@player:m');
  });
});
