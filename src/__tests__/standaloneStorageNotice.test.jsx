/**
 * A private-browsing session that cannot persist the auth token must
 * still complete login (in memory) and tell the user their sign-in
 * will not survive the tab, instead of throwing mid-login.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';

vi.mock('../standalone/sessionStore.js', async (importOriginal) => {
  const real = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...real,
    loadAuthSession: vi.fn(() => null),
    saveAuthSession: vi.fn(() => false),
  };
});

import { StandaloneShell } from '../standalone/StandaloneShell.jsx';

function makeApp() {
  return /** @type {any} */ ({
    auth: null,
    appLog: { add: () => {} },
    loadDiscovery: () => {},
    enterRoom: () => {},
    MatrixClient: function () {},
  });
}

const flush = async () => {
  await new Promise((r) => setTimeout(r, 20));
  await Promise.resolve();
};

let root;
afterEach(() => {
  if (root) {
    render(null, root);
    root.remove();
    root = null;
  }
});

describe('storage-blocked login notice', () => {
  it('proceeds to discovery and shows a dismissible notice', async () => {
    root = document.createElement('div');
    document.body.appendChild(root);
    const app = makeApp();
    render(h(StandaloneShell, { app }), root);
    await flush();

    app.completeLogin({
      homeserver: 'https://matrix.org',
      accessToken: 't',
      userId: '@u:matrix.org',
      displayName: 'U',
      client: {},
    });
    await flush();

    const notice = root.querySelector('#storage-notice');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toMatch(/sign in again/i);

    notice.querySelector('button').click();
    await flush();
    expect(root.querySelector('#storage-notice')).toBeNull();
  });
});
