/**
 * Regression: StandaloneApp.bindUI() must be idempotent (a second
 * call adds no new listeners) and StandaloneApp.destroy() must
 * remove all listeners attached during bindUI(). Without this,
 * any code path that recreates StandaloneApp leaks listeners.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, render } from 'preact';
import { StandaloneApp } from '../standalone/bootstrap.js';
import { DiscoveryScreen } from '../standalone/DiscoveryScreen.jsx';

function setupDom() {
  document.body.innerHTML = '';
  // hs-url must be an input so updateLoginFlows can read .value without throwing.
  const inputIds = new Set(['hs-url', 'new-session-input', 'create-room-input']);
  for (const id of [
    'login-form', 'hs-url', 'sso-btn', 'new-session-btn', 'new-session-input',
    'create-room-btn', 'create-room-input', 'cancel-scan-btn', 'signout-btn',
    'factory-reset-btn', 'leave-room-btn', 'clear-recent-btn', 'discovery-name',
    'discovery-userid', 'active-loading', 'active-list', 'active-empty',
    'screen-login', 'screen-discovery', 'screen-vtt',
  ]) {
    const el = document.createElement(inputIds.has(id) ? 'input' : 'div');
    el.id = id;
    document.body.appendChild(el);
  }
}

describe('StandaloneApp lifecycle', () => {
  beforeEach(() => setupDom());

  it('bindUI is idempotent - calling twice does not double-bind listeners', () => {
    const app = new StandaloneApp();
    const spy = vi.spyOn(window, 'addEventListener');
    app.bindUI();
    const firstCount = spy.mock.calls.length;
    app.bindUI();
    expect(spy.mock.calls.length).toBe(firstCount);
  });

  it('destroy removes window listeners attached by bindUI', () => {
    const app = new StandaloneApp();
    const winRemove = vi.spyOn(window, 'removeEventListener');
    app.bindUI();
    app.destroy();
    expect(winRemove).toHaveBeenCalled();
  });
});

describe('an error raised while switching to discovery', () => {
  // Callers run showScreen('discovery') and then setError before Preact
  // mounts the screen, and loadDiscovery used to blank the error as it
  // started. A single 100ms retry won that race only some of the time.
  const client = {
    getJoinedRooms: async () => [],
    getInvitedRooms: async () => [],
    sync: () => new Promise(() => {}),
  };

  async function openDiscovery(app) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(DiscoveryScreen, { app }), host);
    await app.loadDiscovery();
    app.inviteAbort?.abort();
    return () => { render(null, host); host.remove(); };
  }

  function makeApp() {
    const app = new StandaloneApp({
      doc: document, win: window, container: document.createElement('div'),
    });
    app.auth = { client, userId: '@u:hs', displayName: 'U' };
    return app;
  }

  it('is still shown once the screen has loaded, however late it mounts', async () => {
    const app = makeApp();
    app.setError('discovery-error', 'Failed to start session: boom');
    await new Promise((r) => setTimeout(r, 250));
    const close = await openDiscovery(app);
    const el = document.getElementById('discovery-error');
    expect(el.textContent).toContain('boom');
    expect(el.classList.contains('visible')).toBe(true);
    close();
  });

  it('belongs to that visit: the next load clears it', async () => {
    const app = makeApp();
    app.setError('discovery-error', 'boom');
    const close = await openDiscovery(app);
    await app.loadDiscovery();
    app.inviteAbort?.abort();
    expect(document.getElementById('discovery-error').textContent).toBe('');
    close();
  });
});
