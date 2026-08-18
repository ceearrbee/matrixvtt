/**
 * The header exit action must be non-destructive: tear down the VTT
 * view and return to the discovery room list while the user stays a
 * member of the Matrix room and the room stays in recent sessions.
 * Actually leaving the room is the global menu's confirmed Leave.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { returnToRoomList } from '../standalone/session.js';
import { StandaloneApp } from '../standalone/bootstrap.js';
import { VTT_EVENTS } from '../utils/constants.js';
import {
  saveActiveRoom,
  loadActiveRoom,
  upsertRecentSession,
  loadRecentSessions,
} from '../standalone/sessionStore.js';

function makeApp() {
  return {
    currentSession: {
      userId: '@me:m', roomId: '!r:id', roomName: 'Campaign A',
      homeserver: 'https://m.org', displayName: 'Me', lastUsed: 0,
    },
    auth: { client: { leaveRoom: vi.fn() } },
    matrixVTTClient: {
      destroy: vi.fn(),
      state: { awaitQueueDrain: vi.fn().mockResolvedValue(undefined) },
    },
    appLog: { add: vi.fn() },
    showScreen: vi.fn(),
  };
}

describe('returnToRoomList', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows discovery without a confirmation dialog and without leaving the room', async () => {
    const app = makeApp();
    await returnToRoomList(app);
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(app.auth.client.leaveRoom).not.toHaveBeenCalled();
    expect(app.matrixVTTClient.destroy).toHaveBeenCalledOnce();
    expect(app.currentSession).toBeNull();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });

  it('clears the persisted active room so a reload lands on the list, not the room', async () => {
    saveActiveRoom({ roomId: '!r:id', roomName: 'Campaign A' });
    await returnToRoomList(makeApp());
    expect(loadActiveRoom()).toBeNull();
  });

  it('keeps the room in recent sessions', async () => {
    const app = makeApp();
    upsertRecentSession(app.currentSession);
    await returnToRoomList(app);
    expect(loadRecentSessions().some((s) => s.roomId === '!r:id')).toBe(true);
  });

  it('drains pending writes before destroying the client, surviving a drain failure', async () => {
    const app = makeApp();
    app.matrixVTTClient.state.awaitQueueDrain.mockRejectedValueOnce(new Error('timeout'));
    await returnToRoomList(app);
    expect(app.matrixVTTClient.state.awaitQueueDrain).toHaveBeenCalled();
    expect(app.matrixVTTClient.destroy).toHaveBeenCalledOnce();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });
});

describe('bootstrap wiring', () => {
  it('RETURN_TO_ROOMS on window routes to the discovery screen', async () => {
    const app = new StandaloneApp({
      container: document.createElement('div'),
      matrixVTTClient: { destroy: vi.fn() },
    });
    app.showScreen = vi.fn();
    app.bindUI();
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.RETURN_TO_ROOMS));
    await new Promise((r) => setTimeout(r, 0));
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
    app.destroy();
  });
});
