/**
 * Regression lock for the standalone leave-room flow.
 *
 * `leaveRoom` must not call `app.loadDiscovery()` directly:
 * `loadDiscovery` only repopulates the discovery DOM - it does NOT flip
 * the Preact shell from `screen === 'vtt'` to `'discovery'`, leaving
 * the user on a blank / stale VTT screen. The flow routes through
 * `app.showScreen('discovery')`, which both flips the screen and
 * triggers loadDiscovery via the existing setTimeout in
 * `StandaloneShell.jsx`.
 *
 * The same rule covers the no-session branch and the
 * DELETE_SESSION handler.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { leaveRoom } from '../standalone/session.js';

function makeApp({ withSession = true } = {}) {
  const showScreen = vi.fn();
  const loadDiscovery = vi.fn(async () => {});
  return {
    showScreen,
    loadDiscovery,
    currentSession: withSession
      ? { roomId: '!room:example.org', roomName: 'Game', userId: '@u:example.org' }
      : null,
    matrixVTTClient: { destroy: vi.fn() },
    auth: {
      client: { leaveRoom: vi.fn(async () => {}) },
    },
    appLog: { add: vi.fn() },
  };
}


const flushModal = async () => { await Promise.resolve(); await Promise.resolve(); };
async function leaveViaDialog(app, confirmIt = true) {
  const done = leaveRoom(app);
  await flushModal();
  document.querySelector(confirmIt ? '[data-confirm]' : '[data-cancel]')?.click();
  await done;
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
}

describe('leaveRoom - screen transition', () => {
  it('transitions the shell to the discovery screen after leaving', async () => {
    const app = makeApp();
    await leaveViaDialog(app, true);
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });

  it('transitions to discovery even when there is no current session', async () => {
    const app = makeApp({ withSession: false });
    await leaveViaDialog(app, true);
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });

  it('does not bypass the screen transition by calling loadDiscovery directly', async () => {
    // Direct loadDiscovery calls leave the shell stuck on `screen === 'vtt'`.
    // The discipline is: callers must go through showScreen, never call
    // loadDiscovery themselves. The shell's showScreen handler triggers
    // loadDiscovery for us.
    const app = makeApp();
    await leaveViaDialog(app, true);
    expect(app.loadDiscovery).not.toHaveBeenCalled();
  });

  it('destroys the Matrix client and leaves the room before transitioning', async () => {
    const app = makeApp();
    await leaveViaDialog(app, true);
    expect(app.matrixVTTClient.destroy).toHaveBeenCalled();
    expect(app.auth.client.leaveRoom).toHaveBeenCalledWith('!room:example.org');
  });

  it('clears currentSession before transitioning', async () => {
    const app = makeApp();
    await leaveViaDialog(app, true);
    expect(app.currentSession).toBeNull();
  });
});
