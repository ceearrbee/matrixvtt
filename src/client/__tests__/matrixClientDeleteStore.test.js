/**
 * Factory reset must drop the SDK's IndexedDB sync store (it survives
 * localStorage.clear()). MatrixClient.deleteStoreData(userId) removes the
 * matrix-js-sdk:matrixvtt:<userId> database.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { MatrixClient } from '../MatrixClient.js';

const DB = (userId) => `matrix-js-sdk:matrixvtt:${userId}`;

function openWithStore(name) {
  return new Promise((resolve, reject) => {
    let upgraded = false;
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => { upgraded = true; req.result.createObjectStore('s'); };
    req.onsuccess = () => resolve({ db: req.result, upgraded });
    req.onerror = () => reject(req.error);
  });
}

describe('MatrixClient.deleteStoreData', () => {
  it('deletes the per-user IndexedDB store', async () => {
    const name = DB('@alice:hs');

    // Create + populate, then close so the delete isn't blocked by an open conn.
    const first = await openWithStore(name);
    expect(first.upgraded).toBe(true);
    await new Promise((res) => {
      const tx = first.db.transaction('s', 'readwrite');
      tx.objectStore('s').put('value', 'k');
      tx.oncomplete = res;
    });
    first.db.close();

    await MatrixClient.deleteStoreData('@alice:hs');

    // Reopening triggers onupgradeneeded again only if the db was deleted.
    const second = await openWithStore(name);
    expect(second.upgraded).toBe(true);
    second.db.close();
  });

  it('no-ops without a userId', async () => {
    await expect(MatrixClient.deleteStoreData('')).resolves.toBeUndefined();
  });
});
