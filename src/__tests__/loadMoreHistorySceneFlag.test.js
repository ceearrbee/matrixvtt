/**
 * loadMoreHistory must preserve scene-root metadata so prior-session
 * scenes appear in the IconRail ScenesDrawer.
 *
 * Each `m.room.message` event in the room timeline may carry
 *   content['com.vtt.scene_root'] === true
 *   content['com.vtt.scene_title'] === '…'
 * indicating it's a chat-thread root for a story beat. The live
 * timeline-intake path (src/chat/timeline-intake.js) already extracts
 * these fields. Historical backfill must do the same so a fresh page
 * load can populate the Scenes drawer from existing room history.
 *
 * Bug: _processHistoricalMessages built the activityLog entry without
 * the scene fields, so opening a room with existing scenes showed an
 * empty Scenes drawer ("No scene threads started") until a new scene
 * was started in the current session.
 */
import { describe, it, expect, vi } from 'vitest';
import { loadMoreHistory } from '../ui/log-panel.js';

function makeUi(messages) {
  return {
    activityLog: [],
    _seenLogEventIds: new Set(),
    _logLoadingHistory: false,
    widgetManager: {
      getApi: () => ({
        getMessages: vi.fn().mockResolvedValue({ chunk: messages }),
        hasMoreHistory: true,
      }),
    },
  };
}

describe('loadMoreHistory - historical scene-root backfill', () => {
  it('extracts com.vtt.scene_root + scene_title onto activityLog entries', async () => {
    const ui = makeUi([
      {
        type: 'm.room.message',
        event_id: '$scene1',
        sender: '@gm:m',
        origin_server_ts: 1700000000000,
        content: {
          msgtype: 'm.text',
          body: '🎬 Session 3 - Smoke on the Horizon\n\nThe party stacks against the keep.',
          'com.vtt.scene_root': true,
          'com.vtt.scene_title': 'Session 3 - Smoke on the Horizon',
        },
      },
    ]);
    await loadMoreHistory(ui);
    expect(ui.activityLog.length).toBe(1);
    const entry = ui.activityLog[0];
    expect(entry.isSceneRoot).toBe(true);
    expect(entry.sceneTitle).toBe('Session 3 - Smoke on the Horizon');
    expect(entry.eventId).toBe('$scene1');
  });

  it('historical thread replies carry threadOf set to the parent eventId', async () => {
    const ui = makeUi([
      {
        type: 'm.room.message',
        event_id: '$root',
        sender: '@gm:m',
        content: { msgtype: 'm.text', body: 'root' },
      },
      {
        type: 'm.room.message',
        event_id: '$reply',
        sender: '@player:m',
        content: {
          msgtype: 'm.text', body: 'HARK',
          'm.relates_to': { rel_type: 'm.thread', event_id: '$root' },
        },
      },
    ]);
    await loadMoreHistory(ui);
    const reply = ui.activityLog.find((e) => e.eventId === '$reply');
    expect(reply).toBeTruthy();
    expect(reply.threadOf).toBe('$root');
  });

  it('non-scene historical messages have isSceneRoot=false', async () => {
    const ui = makeUi([
      {
        type: 'm.room.message',
        event_id: '$hello',
        sender: '@gm:m',
        content: { msgtype: 'm.text', body: 'HELLO' },
      },
    ]);
    await loadMoreHistory(ui);
    expect(ui.activityLog[0].isSceneRoot).toBe(false);
    expect(ui.activityLog[0].sceneTitle).toBeNull();
  });

  // Production scene-roots are posted with msgtype 'm.notice' (see
  // scene-mode.js#startScene). Earlier the historical filter only
  // accepted 'm.text' so prior-session scenes silently disappeared
  // on reload - this case locks the regression.
  it('accepts m.notice scene-roots so they survive the historical filter', async () => {
    const ui = makeUi([
      {
        type: 'm.room.message',
        event_id: '$scene2',
        sender: '@gm:m',
        content: {
          msgtype: 'm.notice',
          body: '🎬 Session 4 - The Crypt\n\nAria descends the stairs.',
          'com.vtt.scene_root': true,
          'com.vtt.scene_title': 'Session 4 - The Crypt',
        },
      },
    ]);
    await loadMoreHistory(ui);
    expect(ui.activityLog.length).toBe(1);
    expect(ui.activityLog[0].isSceneRoot).toBe(true);
    expect(ui.activityLog[0].sceneTitle).toBe('Session 4 - The Crypt');
  });

  // Emotes (m.emote) are part of the live CHAT_MSGTYPES set; historical
  // backfill should match.
  it('accepts m.emote messages on the historical path', async () => {
    const ui = makeUi([
      {
        type: 'm.room.message',
        event_id: '$emote',
        sender: '@gm:m',
        content: { msgtype: 'm.emote', body: 'gestures toward the keep' },
      },
    ]);
    await loadMoreHistory(ui);
    expect(ui.activityLog.length).toBe(1);
    expect(ui.activityLog[0].eventId).toBe('$emote');
  });
});
