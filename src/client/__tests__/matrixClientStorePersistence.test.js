/**
 * Persistence proof - the mechanism `MatrixClient._createStore` relies on.
 *
 * `matrixClientStore.test.js` proves the store is *wired* (IndexedDB, per-user
 * dbName, started before sync). This proves the actual behavior the chat-bug
 * fix depends on: a timeline m.room.message written through one IndexedDBStore
 * is read back by a *fresh* store opened with the same dbName - i.e. chat
 * survives a reload. Uses the real `sdk.IndexedDBStore` against fake-indexeddb
 * (no browser, no mock of the store itself).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as sdk from 'matrix-js-sdk';

function syncWithMessage(roomId, body) {
  return {
    next_batch: 's_token_1',
    rooms: {
      join: {
        [roomId]: {
          timeline: {
            events: [{
              type: 'm.room.message',
              event_id: '$evt-1',
              sender: '@alice:hs',
              origin_server_ts: 1,
              content: { msgtype: 'm.text', body },
            }],
            prev_batch: 'p_0',
            limited: false,
          },
          state: { events: [] },
          ephemeral: { events: [] },
          account_data: { events: [] },
          unread_notifications: {},
        },
      },
    },
  };
}

async function openStore(dbName) {
  const store = new sdk.IndexedDBStore(/** @type {any} */ ({
    indexedDB: globalThis.indexedDB,
    localStorage: globalThis.localStorage,
    dbName,
  }));
  await store.startup();
  return store;
}

describe('IndexedDBStore persistence (chat survives reload)', () => {
  it('a timeline message persisted by one store is read back by a fresh store with the same dbName', async () => {
    const dbName = 'matrixvtt-test:@alice:hs';
    const roomId = '!room:hs';

    const store1 = await openStore(dbName);
    await store1.setSyncData(syncWithMessage(roomId, 'hello after reload'));
    await store1.save(true); // force-persist to IndexedDB

    // Simulate a page reload: a brand-new store instance over the same on-disk db.
    const store2 = await openStore(dbName);
    const saved = await store2.getSavedSync();

    expect(saved).not.toBeNull();
    const events = saved.roomsData.join[roomId].timeline.events;
    expect(events.some((e) => e?.content?.body === 'hello after reload')).toBe(true);
  });

  it('a different dbName (another user) cannot read the cached timeline', async () => {
    const store = await openStore('matrixvtt-test:@bob:hs');
    expect(await store.getSavedSync()).toBeNull();
  });
});
