/**
 * compareStateVector - lag is normal; only a fork fires the
 * divergence callback. Regression for the "Collaborative state drift
 * detected" false-positive toast that surfaced on every fresh demo
 * load when a peer broadcast its initial SYNC_VECTOR.
 */
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { YjsManager } from '../YjsManager.js';

function fillDoc(ym, fn) {
  fn(ym.doc);
}

describe('YjsManager.compareStateVector', () => {
  it('does NOT fire onDivergence when we are behind only (lag)', () => {
    const local = new YjsManager('!r:s');
    const remoteDoc = new Y.Doc();
    // Remote has updates we don't (a token write). We have nothing
    // they don't. This is normal lag - Yjs will deliver the missing
    // UPDATE chunks via the timeline.
    remoteDoc.getMap('tokens').set('t1', { id: 't1' });
    const cb = vi.fn();
    local.onDivergence(cb);

    local.compareStateVector(Y.encodeStateVector(remoteDoc));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does NOT fire onDivergence when we are ahead only', () => {
    const local = new YjsManager('!r:s');
    fillDoc(local, (doc) => { doc.getMap('tokens').set('t1', { id: 't1' }); });
    const remoteDoc = new Y.Doc();
    const cb = vi.fn();
    local.onDivergence(cb);

    local.compareStateVector(Y.encodeStateVector(remoteDoc));
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires onDivergence on a true fork (local ahead in one client, behind in another)', () => {
    const local = new YjsManager('!r:s');
    // Local writes from "our" client id (assigned by Yjs).
    fillDoc(local, (doc) => { doc.getMap('tokens').set('local', { id: 'l' }); });

    // Remote has updates from a *different* client id. We force a
    // distinct clientID on the remote so the vectors don't merely
    // overlap.
    const remoteDoc = new Y.Doc();
    remoteDoc.clientID = local.doc.clientID + 1;
    remoteDoc.getMap('tokens').set('remote', { id: 'r' });

    const cb = vi.fn();
    local.onDivergence(cb);

    local.compareStateVector(Y.encodeStateVector(remoteDoc));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onDivergence when state vectors match exactly', () => {
    const local = new YjsManager('!r:s');
    fillDoc(local, (doc) => { doc.getMap('tokens').set('t1', { id: 't1' }); });
    const cb = vi.fn();
    local.onDivergence(cb);

    // Echo our own vector back at ourselves - no divergence possible.
    local.compareStateVector(Y.encodeStateVector(local.doc));
    expect(cb).not.toHaveBeenCalled();
  });
});
