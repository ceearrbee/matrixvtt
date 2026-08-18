/**
 * stop() must clear pending throttle timers so a queued coalesce/stream tick
 * can't fire after the sdk is torn down (unhandled rejection / send against
 * a null sdk).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as sdk from 'matrix-js-sdk';
import { MatrixClient, CLIENT_STATUS } from '../MatrixClient.js';
import { EVENT_TYPES } from '../../utils/constants.js';

vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    on: vi.fn(),
    startClient: vi.fn().mockResolvedValue({}),
    stopClient: vi.fn().mockResolvedValue({}),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$1' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$2' }),
  };
  return { createClient: vi.fn(() => mockClient), Preset: { PrivateChat: 'private_chat' } };
});

const creds = { homeserver: 'https://m.test', accessToken: 't', userId: '@a:m.test' };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

async function connected() {
  const client = new MatrixClient(creds);
  const startP = client.start();
  const mock = sdk.createClient.mock.results.at(-1).value;
  mock.on.mock.calls.find((c) => c[0] === 'sync')[1]('PREPARED');
  await startP;
  return { client, mock };
}

describe('MatrixClient.stop() throttle teardown', () => {
  it('clears a pending coalesce timer so it never fires after stop', async () => {
    const { client, mock } = await connected();

    // Queue a coalesced TOKEN send - schedules a setTimeout.
    client.sendVTTEvent('!r:m', EVENT_TYPES.TOKEN, 'tok-1', { x: 1 });
    const tokenThrottle = client._throttles[EVENT_TYPES.TOKEN];
    expect(tokenThrottle.timer).not.toBeNull();

    await client.stop();
    expect(tokenThrottle.timer).toBeNull();
    expect(client.status).toBe(CLIENT_STATUS.DISCONNECTED);

    // Advancing past the coalesce delay must not send anything (timer cleared).
    const before = mock.sendStateEvent.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(mock.sendStateEvent.mock.calls.length).toBe(before);
  });
});
