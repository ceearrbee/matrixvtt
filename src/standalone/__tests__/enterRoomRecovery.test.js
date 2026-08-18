/**
 * enterRoom failure recovery.
 *
 * A saved active-room id can go stale (room deleted, user kicked,
 * homeserver gone). On bootstrap the shell calls
 * `enterRoom(savedActiveRoom.roomId, ...)`. If `/join` fails, a bare
 * setError + return strands the shell on the 'Restoring session…'
 * loading screen because:
 *   1. The screen stays 'loading' (nobody called showScreen).
 *   2. The #discovery-error target element only exists on the
 *      discovery screen, so the error message is invisible.
 *   3. The saved active-room id stays in storage, so the next reload
 *      re-attempts the same dead join.
 *
 * So on join failure during enterRoom: clear the saved active-room
 * id AND transition to the discovery screen before returning.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterRoom } from '../session.js';
import { loadActiveRoom, saveActiveRoom } from '../sessionStore.js';
import { STORAGE_KEYS } from '../../utils/constants.js';

function makeApp({ joinError }) {
  const calls = { showScreen: [], setError: [] };
  return {
    calls,
    auth: {
      homeserver: 'https://h',
      userId: '@me:h',
      displayName: 'Me',
      client: {
        getJoinedRooms: vi.fn().mockResolvedValue([]),
        joinRoom: vi.fn().mockRejectedValue(joinError),
      },
    },
    appLog: { add: vi.fn() },
    showScreen: (s) => { calls.showScreen.push(s); },
    setError: (id, msg) => { calls.setError.push([id, msg]); },
    auth_userId: '@me:h',
    doc: { getElementById: () => null },
  };
}

beforeEach(() => { localStorage.clear(); });

describe('enterRoom - bootstrap recovery from a stale active-room id', () => {
  it('clears the saved active-room and transitions to discovery on M_NOT_FOUND', async () => {
    saveActiveRoom({ roomId: '!dead:hs', roomName: 'Dead Room' });
    expect(loadActiveRoom()?.roomId).toBe('!dead:hs');

    const err = new Error('Not Found');
    err.errcode = 'M_NOT_FOUND';
    const app = makeApp({ joinError: err });

    await enterRoom(app, '!dead:hs', 'Dead Room');

    expect(loadActiveRoom()).toBeNull();
    expect(app.calls.showScreen).toContain('discovery');
    // The error message is still surfaced for display in the discovery screen.
    const errors = app.calls.setError.map(([id]) => id);
    expect(errors).toContain('discovery-error');
  });

  it('clears the saved active-room and transitions to discovery on M_FORBIDDEN (no knock)', async () => {
    saveActiveRoom({ roomId: '!private:hs', roomName: 'Locked Room' });

    const err = new Error('Forbidden');
    err.errcode = 'M_FORBIDDEN';
    const app = makeApp({ joinError: err });
    // The knock offer is a modal dialog now; decline it.
    const done = enterRoom(app, '!private:hs', 'Locked Room');
    for (let i = 0; i < 30 && !document.querySelector('[data-cancel]'); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    document.querySelector('[data-cancel]')?.click();
    await done;

    expect(loadActiveRoom()).toBeNull();
    expect(app.calls.showScreen).toContain('discovery');
  });
});

// Touch STORAGE_KEYS so the import isn't tree-shaken in dev modes that
// would warn about it. The constant is used elsewhere; importing here
// pins it as a load dependency for the recovery path.
void STORAGE_KEYS;
