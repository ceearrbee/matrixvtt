/**
 * Outbound Yjs updates are coalesced into one merged Matrix event per window
 * instead of one event per Yjs transaction (the firehose that buries chat /
 * risks rate limits). Merging via Y.mergeUpdates must be loss-free.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsMatrixTransport } from '../YjsMatrixTransport.js';
import { YJS_EVENT_TYPES } from '../../state/YjsManager.js';

function mkUpdate(key, val) {
  const d = new Y.Doc();
  d.getMap('tokens').set(key, val);
  return Y.encodeStateAsUpdate(d);
}
const b64ToU8 = (s) => new Uint8Array(atob(s).split('').map((c) => c.charCodeAt(0)));

function makeTransport() {
  let onUpdate;
  const yjsManager = { onUpdate: (cb) => { onUpdate = cb; }, getStateVector: () => new Uint8Array() };
  const matrixClient = {
    status: 'connected', userId: '@u:hs',
    onStatusUpdate: vi.fn(() => () => {}),
    sendVTTEvent: vi.fn().mockResolvedValue({}),
  };
  const transport = new YjsMatrixTransport(matrixClient, yjsManager, '!r:hs');
  return { transport, matrixClient, emit: (u) => onUpdate(u) };
}

const updateSends = (mc) => mc.sendVTTEvent.mock.calls.filter((c) => c[1] === YJS_EVENT_TYPES.UPDATE);

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('YjsMatrixTransport outbound coalescing', () => {
  it('merges a window of local updates into a single, loss-free send', async () => {
    const { transport, matrixClient, emit } = makeTransport();
    const u1 = mkUpdate('a', { n: 1 });
    const u2 = mkUpdate('b', { n: 2 });
    const u3 = mkUpdate('c', { n: 3 });

    emit(u1); emit(u2); emit(u3);
    expect(updateSends(matrixClient)).toHaveLength(0); // still buffered

    await vi.advanceTimersByTimeAsync(300);

    const sends = updateSends(matrixClient);
    expect(sends).toHaveLength(1); // one merged event (single chunk)

    // Loss-free: merged-applied state == sequentially-applied state.
    const merged = b64ToU8(sends[0][3].data);
    const docA = new Y.Doc(); Y.applyUpdate(docA, merged);
    const docB = new Y.Doc(); [u1, u2, u3].forEach((u) => Y.applyUpdate(docB, u));
    expect(docA.getMap('tokens').toJSON()).toEqual(docB.getMap('tokens').toJSON());
    expect(docA.getMap('tokens').toJSON()).toEqual({ a: { n: 1 }, b: { n: 2 }, c: { n: 3 } });

    transport.destroy();
  });

  it('starts a fresh window after a flush', async () => {
    const { transport, matrixClient, emit } = makeTransport();
    emit(mkUpdate('a', { n: 1 }));
    await vi.advanceTimersByTimeAsync(300);
    emit(mkUpdate('b', { n: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(updateSends(matrixClient)).toHaveLength(2); // two windows → two sends
    transport.destroy();
  });
});
