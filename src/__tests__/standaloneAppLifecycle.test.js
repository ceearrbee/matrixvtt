/**
 * Regression: StandaloneApp.bindUI() must be idempotent (a second
 * call adds no new listeners) and StandaloneApp.destroy() must
 * remove all listeners attached during bindUI(). Without this,
 * any code path that recreates StandaloneApp leaks listeners.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandaloneApp } from '../standalone/bootstrap.js';

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

describe('setError survives a screen switch', () => {
  it('retries once when the target element has not mounted yet', async () => {
    const app = new StandaloneApp({
      doc: document, win: window, container: document.createElement('div'),
    });
    // Element appears AFTER the call, as happens when showScreen('discovery')
    // is followed synchronously by setError before Preact mounts the screen.
    app.setError('discovery-error', 'Failed to start session: boom');
    const el = document.createElement('div');
    el.id = 'discovery-error';
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 120));
    expect(el.textContent).toContain('boom');
    expect(el.classList.contains('visible')).toBe(true);
    el.remove();
  });
});
