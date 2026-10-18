/**
 * MatrixVTT does not support encrypted rooms. Entering one stops before
 * the VTT starts, says why on the room list, and leaves no saved room
 * behind for a reload to retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterRoom } from '../session.js';
import { loadActiveRoom, loadRecentSessions } from '../sessionStore.js';

function makeApp({ encrypted }) {
  const initVTT = vi.fn().mockResolvedValue(undefined);
  const app = {
    auth: {
      homeserver: 'https://h',
      accessToken: 'token',
      userId: '@me:h',
      displayName: 'Me',
      client: {
        getJoinedRooms: vi.fn().mockResolvedValue(['!secret:h']),
        joinRoom: vi.fn(),
        getStateEventContent: vi.fn(async (_roomId, type) =>
          (encrypted && type === 'm.room.encryption' ? { algorithm: 'm.megolm.v1.aes-sha2' } : null)),
      },
    },
    appLog: { add: vi.fn() },
    showScreen: vi.fn(),
    setError: vi.fn(),
    doc: { getElementById: () => ({}) },
    matrixVTTClient: { initVTT },
  };
  return { app, initVTT };
}


beforeEach(() => { localStorage.clear(); });

describe('enterRoom with an encrypted room', () => {
  it('refuses to open it and says why', async () => {
    const { app, initVTT } = makeApp({ encrypted: true });
    await enterRoom(app, '!secret:h', 'Secret');
    expect(initVTT).not.toHaveBeenCalled();
    expect(app.showScreen).toHaveBeenCalledWith('discovery');
    const [id, message] = app.setError.mock.calls.at(-1);
    expect(id).toBe('discovery-error');
    expect(message).toMatch(/encrypted/i);
    expect(loadActiveRoom()).toBeNull();
    expect(loadRecentSessions()).toEqual([]);
  });

  it('opens an unencrypted room as usual', async () => {
    const { app, initVTT } = makeApp({ encrypted: false });
    await enterRoom(app, '!secret:h', 'Plain');
    expect(initVTT).toHaveBeenCalled();
  });
});
