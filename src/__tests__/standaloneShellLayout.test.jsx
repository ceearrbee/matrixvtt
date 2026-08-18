/**
 * Standalone shell - two-pane (sidebar + main) layout contract.
 *
 * Mirrors the design language of https://nondescript.design:
 *   - .standalone-shell is a grid; left column .standalone-sidebar,
 *     right column .standalone-main.
 *   - Sidebar owns the brand (MatrixVTT title + tagline) and the
 *     persistent global actions (Docs, Sign Out, Factory Reset). It
 *     renders identically across login + discovery so the visual
 *     anchor doesn't shift between screens.
 *   - Main pane carries the screen-specific content (login form on
 *     auth, recent/active/other rooms on discovery).
 */
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { h } from 'preact';
import { StandaloneShell } from '../standalone/StandaloneShell.jsx';

function makeApp() {
  return /** @type {any} */ ({
    auth: null,
    appLog: { add: () => {} },
    showScreen: (/** @type {string} */ _name) => {},
    loadDiscovery: () => {},
    enterRoom: () => {},
    MatrixClient: function () {},
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
  await Promise.resolve();
}

// The shell's mount effect picks the initial screen asynchronously;
// under full-suite load it can land after a single flush. Wait for the
// login screen before switching screens in a test.
async function settle(root) {
  for (let i = 0; i < 30 && !root.querySelector('#login-form'); i++) await flush();
}

describe('StandaloneShell - sidebar + main layout', () => {
  it('renders a sidebar and a main pane on the login screen', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();
    const shell = root.querySelector('.standalone-shell');
    expect(shell).toBeTruthy();
    expect(shell.querySelector('.standalone-sidebar')).toBeTruthy();
    expect(shell.querySelector('.standalone-main')).toBeTruthy();
  });

  it('sidebar carries the brand on every screen', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();
    const sidebar = root.querySelector('.standalone-sidebar');
    expect(sidebar).toBeTruthy();
    const title = sidebar.querySelector('.standalone-title');
    expect(title?.textContent).toBe('MatrixVTT');
    expect(sidebar.querySelector('.standalone-tagline')?.textContent.length).toBeGreaterThan(10);
  });

  it('sidebar offers theme and reduced-motion controls before login', async () => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();

    const sidebar = root.querySelector('.standalone-sidebar');
    const theme = sidebar.querySelector('#sidebar-theme');
    const motion = sidebar.querySelector('#sidebar-reduced-motion');
    expect(theme).toBeTruthy();
    expect(motion).toBeTruthy();

    theme.value = 'high-contrast';
    theme.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('vtt:accessibility')).theme).toBe('high-contrast');

    motion.checked = true;
    motion.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
    expect(JSON.parse(localStorage.getItem('vtt:accessibility')).reduced_motion).toBe(true);

    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('sidebar shows Docs link on every screen', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();
    const sidebar = root.querySelector('.standalone-sidebar');
    const docsLink = sidebar.querySelector('a[href*="docs"]');
    expect(docsLink).toBeTruthy();
  });

  it('sidebar shows Sign Out and Factory Reset once the discovery screen mounts', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();
    app.showScreen('discovery');
    await flush();
    const sidebar = root.querySelector('.standalone-sidebar');
    expect(sidebar.querySelector('#signout-btn')).toBeTruthy();
    expect(sidebar.querySelector('#factory-reset-btn')).toBeTruthy();
  });

  it('main pane carries the auth-card on login', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();
    const main = root.querySelector('.standalone-main');
    expect(main.querySelector('.auth-card')).toBeTruthy();
  });

  it('main pane carries the discovery-card on discovery', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await settle(root);
    app.showScreen('discovery');
    await flush();
    const main = root.querySelector('.standalone-main');
    expect(main.querySelector('.discovery-card')).toBeTruthy();
  });

  it('Sign Out / Factory Reset are not duplicated in the discovery card body', async () => {
    const root = document.createElement('div');
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await settle(root);
    app.showScreen('discovery');
    await flush();
    const card = root.querySelector('.discovery-card');
    expect(card.querySelector('#signout-btn')).toBeNull();
    expect(card.querySelector('#factory-reset-btn')).toBeNull();
  });
});
