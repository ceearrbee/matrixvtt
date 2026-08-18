/**
 * The snapshot cutoff in YjsManager.handleMatrixUpdate compares an incoming
 * update's homeserver timestamp against the publisher's wall-clock marker.
 * Clock skew between the GM and the homeserver could drop a real post-
 * snapshot update, silently diverging state. A grace window guards against
 * that: updates within the window are still applied; far-older ones are
 * dropped (the pre-snapshot optimisation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsManager } from '../state/YjsManager.js';

let mgr;
beforeEach(() => { mgr = new YjsManager('!r:hs'); });
afterEach(() => { mgr.destroy(); });

// Build a single-chunk update payload (as YjsMatrixTransport would) carrying
// a real Yjs update that sets tokens['t1'].
function updatePayload(timestamp) {
  const src = new Y.Doc();
  src.getMap('tokens').set('t1', { id: 't1', name: 'Goblin' });
  const data = Y.encodeStateAsUpdate(src);
  return { sequenceId: `s-${timestamp}`, index: 0, total: 1, data, timestamp };
}

describe('snapshot cutoff grace window', () => {
  it('applies an update whose timestamp is just below the marker (within grace)', () => {
    const marker = 1_000_000;
    mgr.loadSnapshot(Y.encodeStateAsUpdate(new Y.Doc()), marker);
    mgr.handleMatrixUpdate(updatePayload(marker - 5_000)); // 5s before marker
    expect(mgr.tokensMap.get('t1')).toMatchObject({ name: 'Goblin' });
  });

  it('drops an update far older than the marker (beyond grace)', () => {
    const marker = 1_000_000;
    mgr.loadSnapshot(Y.encodeStateAsUpdate(new Y.Doc()), marker);
    mgr.handleMatrixUpdate(updatePayload(marker - 120_000)); // 2min before marker
    expect(mgr.tokensMap.get('t1')).toBeUndefined();
  });
});
