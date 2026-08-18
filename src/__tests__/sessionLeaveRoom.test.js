/**
 * leaveRoom is the only path that drops a room from the recent-sessions
 * list. localStorage leaks on logout-style flows are a recurring bug
 * class; pin the behavior so a future refactor
 * doesn't leave dead rooms forever in the list. Confirmation now runs
 * through the shared modal dialog, never window.confirm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { leaveRoom } from '../standalone/session.js';

function makeApp() {
  return {
    currentSession: {
      userId: '@me:m', roomId: '!r:id', roomName: 'Campaign A',
      homeserver: 'https://m.org', displayName: 'Me', lastUsed: 0,
    },
    auth: { client: { leaveRoom: vi.fn().mockResolvedValue({}) } },
    matrixVTTClient: { destroy: vi.fn() },
    appLog: { add: vi.fn() },
    showScreen: vi.fn(),
  };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

async function respond(confirmIt) {
  await flush();
  const btn = document.querySelector(confirmIt ? '[data-confirm]' : '[data-cancel]');
  expect(btn, 'confirm dialog did not open').toBeTruthy();
  btn.click();
  await flush();
}

describe('leaveRoom', () => {
  let confirmSpy;
  beforeEach(() => {
    localStorage.clear();
    confirmSpy = vi.fn();
    window.confirm = confirmSpy;
  });
  afterEach(() => {
    document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
  });

  it('aborts when the user declines the confirmation dialog', async () => {
    const app = makeApp();
    const done = leaveRoom(app);
    await respond(false);
    await done;
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(app.auth.client.leaveRoom).not.toHaveBeenCalled();
    expect(app.matrixVTTClient.destroy).not.toHaveBeenCalled();
    expect(app.currentSession).not.toBeNull();
  });

  it('on a clean leave, destroys the VTT client, calls server leave, and reloads discovery', async () => {
    const app = makeApp();
    const done = leaveRoom(app);
    await respond(true);
    await done;
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(app.matrixVTTClient.destroy).toHaveBeenCalledOnce();
    expect(app.auth.client.leaveRoom).toHaveBeenCalledWith('!r:id');
    expect(app.currentSession).toBeNull();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });

  it('still drops the local session when the server leave fails (403/404 desync)', async () => {
    const app = makeApp();
    app.auth.client.leaveRoom.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' })
    );
    const done = leaveRoom(app);
    await respond(true);
    await done;
    expect(app.currentSession).toBeNull();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
    expect(app.appLog.add).toHaveBeenCalledWith('error', expect.stringContaining('leave room failed'));
  });

  it('handles the no-current-session path by tearing down the VTT and reloading discovery', async () => {
    const app = makeApp();
    app.currentSession = null;
    await leaveRoom(app);
    expect(app.matrixVTTClient.destroy).toHaveBeenCalledOnce();
    expect(app.auth.client.leaveRoom).not.toHaveBeenCalled();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });
});
