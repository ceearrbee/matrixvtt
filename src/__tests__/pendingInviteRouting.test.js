/**
 * The bootstrap parks a ?join= invite before the shell mounts and strips
 * it from the URL; the shell consumes it once there is a signed-in
 * client, routing the player through the usual room preview.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandaloneApp } from '../standalone/bootstrap.js';
import { consumePendingInvite, loadPendingInvite, savePendingInvite } from '../standalone/pending-invite.js';
import { confirmAndEnterRoom } from '../standalone/discovery/room-preview.js';

vi.mock('../standalone/discovery/room-preview.js', () => ({
  confirmAndEnterRoom: vi.fn().mockResolvedValue(undefined),
}));

function appWith(search) {
  const history = { replaceState: vi.fn() };
  const location = { search, pathname: '/matrixvtt/app.html' };
  const container = document.createElement('div');
  const app = new StandaloneApp({
    doc: document,
    win: window,
    container,
    history: /** @type {any} */ (history),
    location: /** @type {any} */ (location),
  });
  app.showScreen = vi.fn();
  return { app, history, container };
}

describe('bootstrap parks a ?join= invite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(confirmAndEnterRoom).mockClear();
  });

  it('stores the target and strips the query', async () => {
    const { app, history } = appWith('?join=%21room%3Ahs.example&via=hs.example');
    await app.bootstrap();
    expect(loadPendingInvite()).toEqual({ target: '!room:hs.example', via: ['hs.example'] });
    expect(history.replaceState).toHaveBeenCalledWith({}, '', '/matrixvtt/app.html');
  });

  it('parks nothing for a junk target and says why on the login screen', async () => {
    const { app, history, container } = appWith('?join=nonsense');
    await app.bootstrap();
    await new Promise((r) => setTimeout(r, 0));
    expect(loadPendingInvite()).toBeNull();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(container.textContent).toContain('nonsense');
  });
});

describe('consumePendingInvite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(confirmAndEnterRoom).mockClear();
  });

  it('enters the room once and clears the record', async () => {
    savePendingInvite({ target: '!room:hs.example', via: ['hs.example'] });
    const app = /** @type {any} */ ({});
    expect(await consumePendingInvite(app)).toBe(true);
    expect(confirmAndEnterRoom).toHaveBeenCalledWith(
      app, '!room:hs.example', '!room:hs.example', false, ['hs.example'],
    );
    expect(loadPendingInvite()).toBeNull();
    expect(await consumePendingInvite(app)).toBe(false);
  });

  it('does nothing when no invite is parked', async () => {
    expect(await consumePendingInvite(/** @type {any} */ ({}))).toBe(false);
    expect(confirmAndEnterRoom).not.toHaveBeenCalled();
  });
});
