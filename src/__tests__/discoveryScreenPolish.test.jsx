/**
 * DiscoveryScreen polish - copy contract.
 *
 * The brand / layout / wrapper assertions live in
 * standaloneShellLayout.test.jsx now (the brand moved into the shared
 * sidebar). This file only locks the empty-state copy so a future
 * refactor doesn't quietly revert to "No active VTT sessions."
 */
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { h } from 'preact';
import { DiscoveryScreen } from '../standalone/DiscoveryScreen.jsx';

function makeApp() {
  return /** @type {any} */ ({
    auth: null,
    appLog: { add: () => {} },
    showScreen: () => {},
    loadDiscovery: () => {},
    enterRoom: () => {},
    MatrixClient: function () {},
  });
}

describe('DiscoveryScreen - empty-state copy', () => {
  it('Recent + Active empty states hint at the next action', () => {
    const root = document.createElement('div');
    render(h(DiscoveryScreen, { app: makeApp() }), root);
    const activeEmpty = root.querySelector('#active-empty').textContent;
    const recentEmpty = root.querySelector('#recent-empty').textContent;
    expect(activeEmpty.toLowerCase()).toMatch(/create|join|start/);
    expect(recentEmpty.toLowerCase()).toMatch(/create|join|resume/);
  });

  it('New Session explains that creating a room makes you the GM', () => {
    const root = document.createElement('div');
    render(h(DiscoveryScreen, { app: makeApp() }), root);
    expect(root.textContent).toMatch(/creating a room makes you the gm/i);
    expect(root.textContent).toMatch(/players join with/i);
  });
});

describe('renderRecentSessions - single empty voice', () => {
  it('hides the whole Recent Sessions row (incl. Clear All) when empty', async () => {
    const { renderRecentSessions } = await import('../standalone/discovery/render.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(DiscoveryScreen, { app: makeApp() }), root);
    const app = /** @type {any} */ ({ doc: document, auth: { userId: '@u:hs' } });

    renderRecentSessions(app, [], []);
    expect(document.querySelector('#recent-heading').style.display).toBe('none');
    expect(document.querySelector('#recent-empty').style.display).toBe('none');

    renderRecentSessions(app, [{ roomId: '!r:hs', roomName: 'Camp', userId: '@u:hs' }], []);
    expect(document.querySelector('#recent-heading').style.display).not.toBe('none');

    render(null, root);
    root.remove();
  });
});
