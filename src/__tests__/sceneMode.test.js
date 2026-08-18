import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startScene, leaveScene, restoreActiveScene, enterScene,
  loadActiveScene, persistActiveScene, clearActiveScene,
} from '../ui/scene-mode.js';
import { activeSceneSignal } from '../state/ui-signals.js';

function makeUi(roomId = '!room:example.org', userId = '@gm:example.org') {
  const sent = [];
  const logged = [];
  const sendRoomEvent = vi.fn(async (type, content) => {
    const event_id = `$ev_${sent.length}`;
    sent.push({ type, content, event_id });
    return { event_id };
  });
  return {
    state: {
      sendRoomEvent,
      widgetManager: { roomId, userId },
    },
    _toast: vi.fn(),
    _log: vi.fn((icon, html, opts) => logged.push({ icon, html, opts })),
    _sent: sent,
    _logged: logged,
  };
}

describe('scene-mode', () => {
  beforeEach(() => {
    sessionStorage.clear();
    activeSceneSignal.value = null;
  });

  it('startScene posts a scene-root with the expected fields and sets the signal', async () => {
    const ui = makeUi();
    const scene = await startScene(ui, 'The Drowned Chapel', 'Doors creak open.');
    expect(scene).toBeTruthy();
    expect(scene.title).toBe('The Drowned Chapel');
    expect(activeSceneSignal.value).toEqual(scene);

    expect(ui.state.sendRoomEvent).toHaveBeenCalledTimes(1);
    const [type, content] = ui.state.sendRoomEvent.mock.calls[0];
    expect(type).toBe('m.room.message');
    expect(content.msgtype).toBe('m.notice');
    expect(content['com.vtt.scene_root']).toBe(true);
    expect(content['com.vtt.scene_title']).toBe('The Drowned Chapel');
    expect(content.body).toContain('🎬 The Drowned Chapel');
    expect(content.body).toContain('Doors creak open.');
    expect(content.format).toBe('org.matrix.custom.html');
    expect(content.formatted_body).toContain('🎬 The Drowned Chapel');
  });

  it('startScene with no opening still posts (title-only)', async () => {
    const ui = makeUi();
    const scene = await startScene(ui, 'Quick Cut');
    expect(scene).toBeTruthy();
    const content = ui.state.sendRoomEvent.mock.calls[0][1];
    expect(content.body).toBe('🎬 Quick Cut');
  });

  it('startScene refuses a blank title', async () => {
    const ui = makeUi();
    const scene = await startScene(ui, '   ', 'oops');
    expect(scene).toBeNull();
    expect(ui.state.sendRoomEvent).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalledWith(expect.stringMatching(/title/i), 'error');
  });

  it('persists to sessionStorage and round-trips via loadActiveScene', async () => {
    const ui = makeUi('!r:s');
    await startScene(ui, 'Tavern');
    expect(loadActiveScene('!r:s')?.title).toBe('Tavern');
    // restoreActiveScene re-hydrates the signal from storage.
    activeSceneSignal.value = null;
    restoreActiveScene('!r:s');
    expect(activeSceneSignal.value?.title).toBe('Tavern');
  });

  it('leaveScene clears the signal and sessionStorage', async () => {
    const ui = makeUi('!r:s');
    await startScene(ui, 'A');
    leaveScene(ui);
    expect(activeSceneSignal.value).toBeNull();
    expect(loadActiveScene('!r:s')).toBeNull();
  });

  it('persistActiveScene with null clears the room key', () => {
    persistActiveScene('!r:s', { eventId: '$x', title: 'T' });
    expect(loadActiveScene('!r:s')).not.toBeNull();
    clearActiveScene('!r:s');
    expect(loadActiveScene('!r:s')).toBeNull();
  });

  it('loadActiveScene returns null for unknown / corrupt storage', () => {
    expect(loadActiveScene('!nope:s')).toBeNull();
    sessionStorage.setItem('vtt:active-scene:!bad:s', '{not-json');
    expect(loadActiveScene('!bad:s')).toBeNull();
  });

  it('startScene local-echoes the scene-root to ui._log with chapter chrome', async () => {
    const ui = makeUi();
    await startScene(ui, 'The Drowned Chapel', 'Doors creak open.');
    expect(ui._log).toHaveBeenCalledTimes(1);
    const [icon, html, opts] = ui._log.mock.calls[0];
    expect(icon).toBe('🎬');
    expect(html).toContain('log-entry--scene-root');
    expect(html).toContain('🎬 The Drowned Chapel');
    expect(html).toContain('Doors creak open');
    expect(opts.isSceneRoot).toBe(true);
    expect(opts.sceneTitle).toBe('The Drowned Chapel');
    expect(opts.sender).toBe('@gm:example.org');
    expect(typeof opts.eventId).toBe('string');
  });

  it('startScene does NOT local-echo on a failed send', async () => {
    const ui = makeUi();
    ui.state.sendRoomEvent = vi.fn(async () => { throw new Error('boom'); });
    const scene = await startScene(ui, 'A');
    expect(scene).toBeNull();
    expect(ui._log).not.toHaveBeenCalled();
  });

  it('enterScene sets the signal and persists without sending a Matrix event', () => {
    const ui = makeUi('!r:s');
    enterScene(ui, '$existing-root', 'The Drowned Chapel');
    expect(activeSceneSignal.value).toEqual({ eventId: '$existing-root', title: 'The Drowned Chapel' });
    expect(loadActiveScene('!r:s')).toEqual({ eventId: '$existing-root', title: 'The Drowned Chapel' });
    expect(ui.state.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('enterScene is a no-op when args are missing', () => {
    const ui = makeUi();
    activeSceneSignal.value = null;
    enterScene(ui, '', 'Title');
    enterScene(ui, '$id', '');
    expect(activeSceneSignal.value).toBeNull();
  });
});
