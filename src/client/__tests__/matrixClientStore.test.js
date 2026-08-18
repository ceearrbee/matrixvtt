/**
 * MatrixClient persistent store.
 *
 * The SDK defaults to an in-memory store, so on every page reload the room
 * timeline (chat m.room.message events) is refetched from scratch under
 * initialSyncLimit - and the chatty Yjs *timeline* updates evict chat from
 * that window, so sent messages appear "gone" after reload. Backing the SDK
 * with an IndexedDB store persists the synced timeline across reloads so chat
 * survives. The store is scoped per-user so logging in as another account
 * never reads the previous user's cache, and we fall back to the default
 * in-memory store wherever IndexedDB is unavailable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    on: vi.fn(),
    startClient: vi.fn().mockResolvedValue({}),
    stopClient: vi.fn().mockResolvedValue({}),
  };
  class IndexedDBStore {
    constructor(opts) {
      this.opts = opts;
      this.startup = vi.fn().mockResolvedValue(undefined);
    }
  }
  class MemoryStore {
    constructor(opts) { this.opts = opts; }
  }
  return {
    createClient: vi.fn(() => mockClient),
    IndexedDBStore,
    MemoryStore,
    request: vi.fn(),
    Preset: { PrivateChat: 'private_chat' },
  };
});

import * as sdk from 'matrix-js-sdk';
import { MatrixClient } from '../MatrixClient.js';

const credentials = {
  homeserver: 'https://matrix.org',
  accessToken: 's3cret',
  userId: '@alice:matrix.org',
};

const lastCreateOpts = () => sdk.createClient.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.indexedDB = /** @type {any} */ ({}); // truthy → IndexedDB available
});
afterEach(() => {
  delete globalThis.indexedDB;
});

describe('MatrixClient persistent store', () => {
  it('backs the SDK with a per-user IndexedDB store when IndexedDB is available', () => {
    new MatrixClient(credentials);
    const store = lastCreateOpts().store;
    expect(store).toBeInstanceOf(sdk.IndexedDBStore);
    // Scoped to the user so another account can't read this cache.
    expect(String(store.opts.dbName)).toContain('@alice:matrix.org');
  });

  it('starts the store before the sync loop so the persisted timeline loads first', async () => {
    const client = new MatrixClient(credentials);
    const store = lastCreateOpts().store;
    const mockClient = sdk.createClient.mock.results.at(-1).value;

    const startPromise = client.start();
    const syncCb = mockClient.on.mock.calls.find((c) => c[0] === 'sync')[1];
    syncCb('PREPARED');
    await startPromise;

    expect(store.startup).toHaveBeenCalled();
    expect(mockClient.startClient).toHaveBeenCalled();
    expect(store.startup.mock.invocationCallOrder[0])
      .toBeLessThan(mockClient.startClient.mock.invocationCallOrder[0]);
  });

  it('falls back to the default in-memory store when IndexedDB is unavailable', () => {
    delete globalThis.indexedDB;
    expect(() => new MatrixClient(credentials)).not.toThrow();
    const store = lastCreateOpts().store;
    expect(store == null || !(store instanceof sdk.IndexedDBStore)).toBe(true);
  });
});
