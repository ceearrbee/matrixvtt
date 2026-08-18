/**
 * startVTT must not stamp room-visited: the stamp could land before
 * render-policy's rAF read it, suppressing the wizard for the GM who
 * just created the room. Stamping belongs to render-policy's
 * non-wizard branch and the wizard's own close handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startVTT } from '../standalone/session.js';
import { roomAlreadyVisited } from '../utils/room-visited.js';

beforeEach(() => {
  localStorage.clear();
});

function makeApp() {
  return /** @type {any} */ ({
    auth: { homeserver: 'https://hs', accessToken: 't', userId: '@gm:hs' },
    currentSession: null,
    showScreen: vi.fn(),
    doc: { getElementById: () => document.createElement('div') },
    matrixVTTClient: { initVTT: vi.fn().mockResolvedValue(undefined) },
    appLog: { add: vi.fn() },
  });
}

describe('startVTT visited stamping', () => {
  it('does not stamp room-visited (render-policy owns the stamp)', async () => {
    const app = makeApp();
    await startVTT(app, { roomId: '!new:hs', roomName: 'Fresh' }, true);
    expect(app.matrixVTTClient.initVTT).toHaveBeenCalled();
    expect(roomAlreadyVisited('@gm:hs', '!new:hs')).toBe(false);
  });
});
