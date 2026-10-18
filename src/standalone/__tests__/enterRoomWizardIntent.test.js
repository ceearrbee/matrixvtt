/**
 * Joining a room is not a request to set up a campaign in it. Only the
 * Create Room flow asks for the setup wizard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterRoom } from '../session.js';

function makeApp({ joined = [] } = {}) {
  const initVTT = vi.fn().mockResolvedValue(undefined);
  const app = {
    auth: {
      homeserver: 'https://h',
      accessToken: 'token',
      userId: '@me:h',
      displayName: 'Me',
      client: {
        getJoinedRooms: vi.fn().mockResolvedValue(joined),
        joinRoom: vi.fn().mockResolvedValue('!chat:h'),
        getStateEventContent: vi.fn().mockResolvedValue(null),
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

describe('enterRoom wizard intent', () => {
  it('joining an existing room opens it without forcing the wizard', async () => {
    const { app, initVTT } = makeApp();
    await enterRoom(app, '#chat:h', 'Chat');
    expect(initVTT).toHaveBeenCalledWith('https://h', 'token', '@me:h', '!chat:h', false);
  });

  it('a room created from MatrixVTT still asks for the wizard', async () => {
    const { app, initVTT } = makeApp({ joined: ['!new:h'] });
    await enterRoom(app, '!new:h', 'New', true);
    expect(initVTT).toHaveBeenCalledWith('https://h', 'token', '@me:h', '!new:h', true);
  });
});
