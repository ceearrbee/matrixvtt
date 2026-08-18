/**
 * Leaving a room must produce a blank slate.
 *
 * Three combined fixes:
 *   1. The global menu's "Leave room" (StandaloneApp.leaveRoom) actually
 *      calls Matrix client.leaveRoom and removes the recent.
 *   2. The discovery scan's pruneDeletedRecent drops recents for
 *      rooms the user is no longer joined to.
 *   3. Discovery's per-card "Leave" handler removes the recent after
 *      a successful Matrix leave.
 *
 * Without these, leaving a room would either keep it on the server
 * (header path), or keep it as a stale recent (discovery path), and
 * the user would loop back into the room on the next reload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leaveRoom } from '../standalone/session.js';
import { pruneDeletedRecent } from '../standalone/discovery/scan.js';
import { saveRecentSessions, loadRecentSessions } from '../standalone/sessionStore.js';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});


const flushModal = async () => { await Promise.resolve(); await Promise.resolve(); };
async function leaveViaDialog(app, confirmIt = true) {
  const done = leaveRoom(app);
  await flushModal();
  document.querySelector(confirmIt ? '[data-confirm]' : '[data-cancel]')?.click();
  await done;
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
}

describe('leaveRoom (global menu)', () => {
  it('calls client.leaveRoom and removes the recent on confirm', async () => {
    saveRecentSessions([
      { userId: '@me:hs', roomId: '!a:hs', roomName: 'A', homeserver: 'h', lastUsed: 1 },
      { userId: '@me:hs', roomId: '!b:hs', roomName: 'B', homeserver: 'h', lastUsed: 2 },
    ]);
    const leaveSpy = vi.fn().mockResolvedValue(undefined);
    const app = {
      currentSession: { userId: '@me:hs', roomId: '!a:hs', roomName: 'A' },
      matrixVTTClient: { destroy: vi.fn() },
      auth: { client: { leaveRoom: leaveSpy } },
      appLog: { add: vi.fn() },
      showScreen: vi.fn(),
    };
    await leaveViaDialog(app, true);

    expect(leaveSpy).toHaveBeenCalledWith('!a:hs');
    expect(loadRecentSessions().map((s) => s.roomId)).toEqual(['!b:hs']);
    expect(app.currentSession).toBeNull();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
  });

  it('still removes the recent when client.leaveRoom rejects (out-of-sync membership)', async () => {
    saveRecentSessions([{ userId: '@me:hs', roomId: '!a:hs', roomName: 'A', homeserver: 'h', lastUsed: 1 }]);
    const app = {
      currentSession: { userId: '@me:hs', roomId: '!a:hs', roomName: 'A' },
      matrixVTTClient: { destroy: vi.fn() },
      auth: { client: { leaveRoom: vi.fn().mockRejectedValue(new Error('M_FORBIDDEN')) } },
      appLog: { add: vi.fn() },
      showScreen: vi.fn(),
    };
    await leaveViaDialog(app, true);

    expect(loadRecentSessions()).toEqual([]);
  });

  it('does nothing when the user cancels the confirm', async () => {
    saveRecentSessions([{ userId: '@me:hs', roomId: '!a:hs', roomName: 'A', homeserver: 'h', lastUsed: 1 }]);
    const leaveSpy = vi.fn();
    const app = {
      currentSession: { userId: '@me:hs', roomId: '!a:hs', roomName: 'A' },
      matrixVTTClient: { destroy: vi.fn() },
      auth: { client: { leaveRoom: leaveSpy } },
      appLog: { add: vi.fn() },
      showScreen: vi.fn(),
    };
    await leaveViaDialog(app, false);

    expect(leaveSpy).not.toHaveBeenCalled();
    expect(loadRecentSessions()).toHaveLength(1);
    expect(app.currentSession).toEqual({ userId: '@me:hs', roomId: '!a:hs', roomName: 'A' });
    expect(app.showScreen).not.toHaveBeenCalled();
  });
});

describe('pruneDeletedRecent', () => {
  it('drops a recent when the user is no longer joined to the room', () => {
    const recents = [
      { userId: '@me:hs', roomId: '!a:hs' },
      { userId: '@me:hs', roomId: '!b:hs' },
    ];
    const results = [{ id: '!a:hs', vttState: { foo: 'bar' } }];
    const joinedIds = ['!a:hs']; // !b:hs not joined anymore
    const survivors = pruneDeletedRecent(recents, results, joinedIds);
    expect(survivors.map((s) => s.roomId)).toEqual(['!a:hs']);
  });

  it('drops a recent when its VTT state was tombstoned', () => {
    const recents = [{ userId: '@me:hs', roomId: '!a:hs' }];
    const results = [{ id: '!a:hs', vttState: {} }];
    const joinedIds = ['!a:hs'];
    expect(pruneDeletedRecent(recents, results, joinedIds)).toEqual([]);
  });

  it('keeps a recent when the user is still joined and state is non-empty', () => {
    const recents = [{ userId: '@me:hs', roomId: '!a:hs' }];
    const results = [{ id: '!a:hs', vttState: { tokens: 1 } }];
    const survivors = pruneDeletedRecent(recents, results, ['!a:hs']);
    expect(survivors).toHaveLength(1);
  });

  it('without joinedIds, only prunes tombstoned-state rooms (back-compat)', () => {
    const recents = [
      { userId: '@me:hs', roomId: '!a:hs' },
      { userId: '@me:hs', roomId: '!b:hs' },
    ];
    const results = [{ id: '!a:hs', vttState: {} }];
    const survivors = pruneDeletedRecent(recents, results);
    expect(survivors.map((s) => s.roomId)).toEqual(['!b:hs']);
  });
});
