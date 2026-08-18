/**
 * DiscoveryScreen join field: invite links and room IDs both work, and
 * garbage input gets a friendly error instead of a homeserver 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { DiscoveryScreen } from '../standalone/DiscoveryScreen.jsx';
import { confirmAndEnterRoom } from '../standalone/discovery/room-preview.js';

vi.mock('../standalone/discovery/room-preview.js', () => ({
  confirmAndEnterRoom: vi.fn().mockResolvedValue(undefined),
}));

function makeApp() {
  return /** @type {any} */ ({
    auth: null,
    appLog: { add: () => {} },
    showScreen: () => {},
    loadDiscovery: () => {},
    setError: vi.fn(),
  });
}

function mountScreen(app) {
  const root = document.createElement('div');
  render(h(DiscoveryScreen, { app }), root);
  return root;
}

async function join(root, value) {
  const input = root.querySelector('#new-session-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  root.querySelector('#new-session-btn').click();
  await new Promise((r) => setTimeout(r, 0));
}

describe('DiscoveryScreen join field', () => {
  beforeEach(() => {
    vi.mocked(confirmAndEnterRoom).mockClear();
  });

  it('joins from a matrix.to invite link, passing via servers through', async () => {
    const app = makeApp();
    const root = mountScreen(app);
    await join(root, 'https://matrix.to/#/!abc:server.org?via=one.org');

    expect(confirmAndEnterRoom).toHaveBeenCalledWith(
      app, '!abc:server.org', '!abc:server.org', false, ['one.org'],
    );
  });

  it('still joins from a raw room ID', async () => {
    const app = makeApp();
    const root = mountScreen(app);
    await join(root, '!abc:server.org');

    expect(confirmAndEnterRoom).toHaveBeenCalledWith(
      app, '!abc:server.org', '!abc:server.org', false, [],
    );
  });

  it('shows a friendly error for garbage input', async () => {
    const app = makeApp();
    const root = mountScreen(app);
    await join(root, 'not a room at all');

    expect(confirmAndEnterRoom).not.toHaveBeenCalled();
    expect(app.setError).toHaveBeenCalledWith(
      'discovery-error', expect.stringMatching(/room ID|alias|invite link/i),
    );
  });

  it('does nothing on empty input', async () => {
    const app = makeApp();
    const root = mountScreen(app);
    await join(root, '   ');

    expect(confirmAndEnterRoom).not.toHaveBeenCalled();
    expect(app.setError).not.toHaveBeenCalled();
  });

  it('tells the user an invite link works in the placeholder', () => {
    const root = mountScreen(makeApp());
    const input = root.querySelector('#new-session-input');
    expect(input.getAttribute('placeholder').toLowerCase()).toContain('invite link');
  });
});
