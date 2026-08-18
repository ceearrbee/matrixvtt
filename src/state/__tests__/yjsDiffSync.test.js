import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { classifyVectors, electResponder, jitterForUser, PEER_TTL_MS } from '../yjs-diff-sync.js';
import { YjsManager } from '../YjsManager.js';

function docWith(mutate) {
  const doc = new Y.Doc();
  mutate?.(doc);
  return doc;
}

const vectorOf = (doc) => Y.encodeStateVector(doc);

describe('classifyVectors', () => {
  it('flags a peer missing local data as behind', () => {
    const local = docWith((d) => d.getMap('t').set('a', 1));
    const peer = docWith();
    const res = classifyVectors(vectorOf(local), vectorOf(peer));
    expect(res).toEqual({ peerBehind: true, peerAhead: false });
  });

  it('flags a fork as both behind and ahead', () => {
    const local = docWith((d) => d.getMap('t').set('a', 1));
    const peer = docWith((d) => d.getMap('t').set('b', 2));
    const res = classifyVectors(vectorOf(local), vectorOf(peer));
    expect(res).toEqual({ peerBehind: true, peerAhead: true });
  });

  it('reports neither for identical vectors', () => {
    const doc = docWith((d) => d.getMap('t').set('a', 1));
    const res = classifyVectors(vectorOf(doc), vectorOf(doc));
    expect(res).toEqual({ peerBehind: false, peerAhead: false });
  });
});

describe('electResponder', () => {
  const now = 1_000_000;
  const fullDoc = docWith((d) => d.getMap('t').set('a', 1));
  const emptyDoc = docWith();
  const localVector = vectorOf(fullDoc);

  it('elects the lowest userId among caught-up peers, self included', () => {
    const peers = new Map([
      ['@zed:hs', { vector: vectorOf(fullDoc), seenAt: now }],
      ['@amy:hs', { vector: vectorOf(fullDoc), seenAt: now }],
    ]);
    expect(electResponder({ selfId: '@bob:hs', localVector, peers, now })).toBe('@amy:hs');
  });

  it('elects self when the roster is empty', () => {
    expect(electResponder({ selfId: '@bob:hs', localVector, peers: new Map(), now })).toBe('@bob:hs');
  });

  it('excludes lagging peers from candidacy', () => {
    const peers = new Map([
      ['@amy:hs', { vector: vectorOf(emptyDoc), seenAt: now }],
    ]);
    expect(electResponder({ selfId: '@bob:hs', localVector, peers, now })).toBe('@bob:hs');
  });

  it('excludes stale roster entries', () => {
    const peers = new Map([
      ['@amy:hs', { vector: vectorOf(fullDoc), seenAt: now - PEER_TTL_MS - 1 }],
    ]);
    expect(electResponder({ selfId: '@bob:hs', localVector, peers, now })).toBe('@bob:hs');
  });
});

describe('jitterForUser', () => {
  it('is deterministic and bounded to [200, 800)', () => {
    const a = jitterForUser('@alice:matrix.org');
    expect(a).toBe(jitterForUser('@alice:matrix.org'));
    for (const id of ['@alice:matrix.org', '@bob:hs', '@x:y']) {
      const j = jitterForUser(id);
      expect(j).toBeGreaterThanOrEqual(200);
      expect(j).toBeLessThan(800);
    }
  });
});

describe('YjsManager diff support', () => {
  it('encodeDiffSince returns exactly the missing ops', () => {
    const a = new YjsManager('!r:hs');
    const b = new YjsManager('!r:hs');
    try {
      a.tokensMap.set('t1', { x: 1 });
      const diff = a.encodeDiffSince(b.getStateVector());
      Y.applyUpdate(b.doc, diff, 'remote');
      expect(b.tokensMap.get('t1')).toEqual({ x: 1 });
    } finally {
      a.destroy();
      b.destroy();
    }
  });

  it('compareStateVector returns behind/ahead/forked', () => {
    const a = new YjsManager('!r:hs');
    const b = new YjsManager('!r:hs');
    try {
      a.tokensMap.set('t1', { x: 1 });
      b.tokensMap.set('t2', { x: 2 });
      const res = a.compareStateVector(b.getStateVector());
      expect(res).toEqual({ behind: true, ahead: true, forked: true });

      const lagOnly = a.compareStateVector(a.getStateVector());
      expect(lagOnly.forked).toBe(false);
    } finally {
      a.destroy();
      b.destroy();
    }
  });
});
