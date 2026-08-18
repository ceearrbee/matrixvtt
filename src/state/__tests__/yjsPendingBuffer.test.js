import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { YjsPendingBuffer } from '../yjs-pending-buffer.js';

const roomId = '!pending:test';

function docUpdate(mutate) {
  const doc = new Y.Doc();
  mutate(doc);
  return Y.encodeStateAsUpdate(doc);
}

function fakeStorage(overrides = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
    ...overrides,
  };
}

describe('YjsPendingBuffer', () => {
  it('keys persistence off the room id', () => {
    const buf = new YjsPendingBuffer(roomId, { storage: fakeStorage() });
    expect(buf.storageKey).toBe(`vtt:yjs-pending:${roomId}`);
  });

  it('merges added updates losslessly', () => {
    const buf = new YjsPendingBuffer(roomId, { storage: fakeStorage() });
    buf.add(docUpdate((d) => d.getMap('tokens').set('a', { x: 1 })));
    buf.add(docUpdate((d) => d.getMap('tokens').set('b', { x: 2 })));
    expect(buf.count).toBe(2);

    const merged = buf.takeAll();
    expect(buf.isEmpty).toBe(true);
    expect(buf.count).toBe(0);

    const target = new Y.Doc();
    Y.applyUpdate(target, merged);
    expect(target.getMap('tokens').get('a')).toEqual({ x: 1 });
    expect(target.getMap('tokens').get('b')).toEqual({ x: 2 });
  });

  it('does not drop data at high volume (no drop-oldest)', () => {
    const buf = new YjsPendingBuffer(roomId, { storage: fakeStorage() });
    const doc = new Y.Doc();
    const map = doc.getMap('tokens');
    for (let i = 0; i < 150; i++) {
      let update = null;
      const capture = (u) => { update = u; };
      doc.on('update', capture);
      map.set(`t${i}`, { i });
      doc.off('update', capture);
      buf.add(update);
    }

    const target = new Y.Doc();
    Y.applyUpdate(target, buf.takeAll());
    expect(target.getMap('tokens').size).toBe(150);
    expect(target.getMap('tokens').get('t0')).toEqual({ i: 0 });
    expect(target.getMap('tokens').get('t149')).toEqual({ i: 149 });
  });

  it('round-trips through storage via persist and restore', () => {
    const storage = fakeStorage();
    const buf = new YjsPendingBuffer(roomId, { storage });
    buf.add(docUpdate((d) => d.getMap('fog').set('m1', { cells: [1, 2] })));
    buf.persist();

    const later = new YjsPendingBuffer(roomId, { storage });
    const restored = later.restore();
    expect(restored).toBeInstanceOf(Uint8Array);

    const target = new Y.Doc();
    Y.applyUpdate(target, restored);
    expect(target.getMap('fog').get('m1')).toEqual({ cells: [1, 2] });

    expect(later.restore()).toBeNull();
  });

  it('persisting an empty buffer clears any stored copy', () => {
    const storage = fakeStorage();
    const buf = new YjsPendingBuffer(roomId, { storage });
    buf.add(docUpdate((d) => d.getMap('tokens').set('x', {})));
    buf.persist();
    buf.takeAll();
    buf.persist();
    expect(new YjsPendingBuffer(roomId, { storage }).restore()).toBeNull();
  });

  it('survives storage write failures without throwing', () => {
    const storage = fakeStorage({ setItem: () => { throw new Error('QuotaExceededError'); } });
    const buf = new YjsPendingBuffer(roomId, { storage });
    buf.add(docUpdate((d) => d.getMap('tokens').set('x', {})));
    expect(() => buf.persist()).not.toThrow();
    expect(buf.count).toBe(1);
  });

  it('restore returns null when nothing was stored', () => {
    const buf = new YjsPendingBuffer(roomId, { storage: fakeStorage() });
    expect(buf.restore()).toBeNull();
  });
});
