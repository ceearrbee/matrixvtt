/**
 * The discovery screen's Cancel button next to "Loading rooms…" was
 * rendered but had no click handler: a user with hundreds of rooms
 * clicked Cancel and nothing happened. It must flip app.scanCancelled,
 * which the chunked scan loop already checks between chunks.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render } from 'preact';
import { DiscoveryScreen } from '../standalone/DiscoveryScreen.jsx';
import { scanRooms } from '../standalone/discovery/scan.js';

describe('cancel-scan button', () => {
  it('flips app.scanCancelled when clicked', () => {
    const app = /** @type {any} */ ({ scanCancelled: false, auth: { userId: '@u:hs' } });
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(DiscoveryScreen, { app }), root);

    root.querySelector('#cancel-scan-btn').click();
    expect(app.scanCancelled).toBe(true);

    render(null, root);
    root.remove();
  });
});

describe('scanRooms cancellation', () => {
  it('stops issuing chunk fetches after the flag flips', async () => {
    const app = { scanCancelled: false };
    let calls = 0;
    const client = {
      getRoomName: vi.fn(async () => {
        calls++;
        if (calls >= 5) app.scanCancelled = true;
        return 'room';
      }),
      getVttState: vi.fn(async () => ({})),
    };
    const roomIds = Array.from({ length: 40 }, (_, i) => `!r${i}:hs`);

    const results = await scanRooms(app, client, roomIds);

    // First chunk (10) completes; the flag set during it stops chunk 2+.
    expect(client.getRoomName).toHaveBeenCalledTimes(10);
    expect(results.length).toBe(10);
  });
});
