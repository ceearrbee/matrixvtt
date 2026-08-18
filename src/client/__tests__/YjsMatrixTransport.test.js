/**
 * YjsMatrixTransport handles the binary-Yjs <-> Matrix-event boundary.
 * Pin the chunking + base64 round-trip + handleIncomingEvent dispatch
 * that the rest of the Yjs stack depends on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsMatrixTransport } from '../YjsMatrixTransport.js';
import { YJS_EVENT_TYPES } from '../../state/YjsManager.js';

// The pending buffer merges via Y.mergeUpdates, so buffered-path tests
// need real Yjs update binaries rather than arbitrary bytes.
function realUpdate(mutate) {
  const doc = new Y.Doc();
  mutate(doc);
  return Y.encodeStateAsUpdate(doc);
}

function decodeSentUpdate(content) {
  const target = new Y.Doc();
  Y.applyUpdate(target, Uint8Array.from(atob(content.data), (c) => c.charCodeAt(0)));
  return target;
}

function makeYjsManager() {
  let onUpdateCb = null;
  return {
    onUpdate: (cb) => { onUpdateCb = cb; },
    handleMatrixUpdate: vi.fn(),
    compareStateVector: vi.fn(),
    getStateVector: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    _trigger: (update) => onUpdateCb?.(update),
  };
}

async function flushMicrotasks() {
  // _trigger -> _sendChunkedUpdate is async; let pending awaits settle
  // without invoking the divergence-check setInterval (which would loop
  // forever under fake timers).
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// Connected outbound sends are coalesced behind a 300ms window now; fire it
// (well under the 30s divergence interval) then settle the async send chain.
async function flushOutbound() {
  await vi.advanceTimersByTimeAsync(300);
  await flushMicrotasks();
}

function makeMatrixClient(initialStatus = 'connected') {
  let listener = null;
  return {
    userId: '@me:m',
    status: initialStatus,
    sendVTTEvent: vi.fn().mockResolvedValue({}),
    onStatusUpdate(cb) { listener = cb; cb(initialStatus); return () => { listener = null; }; },
    _setStatus(next) { this.status = next; listener?.(next); },
  };
}

describe('YjsMatrixTransport', () => {
  let yjs, mc, transport;
  beforeEach(() => {
    vi.useFakeTimers();
    yjs = makeYjsManager();
    mc = makeMatrixClient();
    transport = new YjsMatrixTransport(mc, yjs, '!r:id');
  });

  afterEach(() => {
    transport.destroy();
    vi.useRealTimers();
  });

  describe('outbound chunking', () => {
    it('sends a small (<60KB) update as a single chunk with idx=0/total=1', async () => {
      yjs._trigger(new Uint8Array([10, 20, 30]));
      await flushOutbound();
      expect(mc.sendVTTEvent).toHaveBeenCalledTimes(1);
      const [roomId, type, stateKey, content] = mc.sendVTTEvent.mock.calls[0];
      expect(roomId).toBe('!r:id');
      expect(type).toBe(YJS_EVENT_TYPES.UPDATE);
      expect(stateKey).toBeNull();
      expect(content.idx).toBe(0);
      expect(content.total).toBe(1);
      expect(typeof content.seq).toBe('string');
      expect(typeof content.data).toBe('string');
    });

    it('splits an oversized update across multiple chunks with a shared sequence id', async () => {
      // _MAX_CHUNK_SIZE is 24000 - pick an input size that produces
      // exactly 3 chunks so we don't have to recompute when tuning.
      const big = new Uint8Array(24000 * 2 + 100); // 3 chunks
      for (let i = 0; i < big.length; i++) big[i] = i % 256;
      yjs._trigger(big);
      await flushOutbound();
      expect(mc.sendVTTEvent).toHaveBeenCalledTimes(3);
      const seqs = mc.sendVTTEvent.mock.calls.map(c => c[3].seq);
      expect(new Set(seqs).size).toBe(1);
      const idxs = mc.sendVTTEvent.mock.calls.map(c => c[3].idx);
      expect(idxs).toEqual([0, 1, 2]);
      expect(mc.sendVTTEvent.mock.calls.every(c => c[3].total === 3)).toBe(true);
    });

    it('gives each update its own sequence id even when triggered back-to-back', async () => {
      yjs._trigger(new Uint8Array([1]));
      await flushOutbound();
      // Sequence id mixes Date.now() with a counter; advance the clock
      // so a hypothetical Date-only collision still differentiates.
      vi.setSystemTime(new Date(Date.now() + 1));
      yjs._trigger(new Uint8Array([2]));
      await flushOutbound();
      const seqs = mc.sendVTTEvent.mock.calls.map(c => c[3].seq);
      expect(seqs[0]).not.toBe(seqs[1]);
    });
  });

  describe('inbound dispatch', () => {
    it('routes UPDATE events into yjsManager.handleMatrixUpdate with decoded data', async () => {
      // Send an outbound first so we can use the matching encode path.
      yjs._trigger(new Uint8Array([100, 200, 50]));
      await flushOutbound();
      const out = mc.sendVTTEvent.mock.calls[0][3];

      transport.handleIncomingEvent({
        type: YJS_EVENT_TYPES.UPDATE,
        content: { seq: out.seq, idx: 0, total: 1, data: out.data },
        origin_server_ts: 12345,
      });

      expect(yjs.handleMatrixUpdate).toHaveBeenCalledWith({
        sequenceId: out.seq,
        index: 0,
        total: 1,
        data: expect.any(Uint8Array),
        timestamp: 12345,
      });
      const decoded = yjs.handleMatrixUpdate.mock.calls[0][0].data;
      expect(Array.from(decoded)).toEqual([100, 200, 50]);
    });

    it('routes SYNC_VECTOR events into yjsManager.compareStateVector', () => {
      // Encode via the symmetric helper.
      const vec = new Uint8Array([7, 8, 9]);
      const data = btoa(String.fromCharCode.apply(null, vec));
      transport.handleIncomingEvent({
        type: YJS_EVENT_TYPES.SYNC_VECTOR,
        content: { vector: data },
        origin_server_ts: 0,
      });
      const got = yjs.compareStateVector.mock.calls[0][0];
      expect(Array.from(got)).toEqual([7, 8, 9]);
    });

    it('ignores unrelated event types', () => {
      transport.handleIncomingEvent({
        type: 'm.room.message',
        content: { body: 'hi' },
        origin_server_ts: 0,
      });
      expect(yjs.handleMatrixUpdate).not.toHaveBeenCalled();
      expect(yjs.compareStateVector).not.toHaveBeenCalled();
    });
  });

  describe('divergence check', () => {
    it('skips the broadcast while the matrix client is offline', async () => {
      mc.status = 'offline';
      await vi.advanceTimersByTimeAsync(30000);
      // The divergence interval should not produce a SYNC_VECTOR send.
      expect(mc.sendVTTEvent).not.toHaveBeenCalled();
    });

    it('sends a SYNC_VECTOR every 30s when connected', async () => {
      mc.status = 'connected';
      await vi.advanceTimersByTimeAsync(30000);
      const calls = mc.sendVTTEvent.mock.calls.filter(c => c[1] === YJS_EVENT_TYPES.SYNC_VECTOR);
      expect(calls).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('clears the divergence interval so no broadcast fires after teardown', async () => {
      mc.status = 'connected';
      transport.destroy();
      mc.sendVTTEvent.mockClear();
      await vi.advanceTimersByTimeAsync(60000);
      const calls = mc.sendVTTEvent.mock.calls.filter(c => c[1] === YJS_EVENT_TYPES.SYNC_VECTOR);
      expect(calls).toHaveLength(0);
    });
  });

  describe('pre-CONNECTED buffering', () => {
    it('buffers updates fired while status is connecting and drains merged on first connected', async () => {
      transport.destroy(); // tear down the default-connected fixture
      yjs = makeYjsManager();
      mc = makeMatrixClient('connecting');
      transport = new YjsMatrixTransport(mc, yjs, '!r:id');

      yjs._trigger(realUpdate((d) => d.getMap('t').set('a', 1)));
      yjs._trigger(realUpdate((d) => d.getMap('t').set('b', 2)));
      yjs._trigger(realUpdate((d) => d.getMap('t').set('c', 3)));
      await flushMicrotasks();
      expect(mc.sendVTTEvent).not.toHaveBeenCalled();

      mc._setStatus('connected');
      await vi.advanceTimersByTimeAsync(0);
      await flushMicrotasks();

      // The buffer merges losslessly, so one send carries all three edits.
      expect(mc.sendVTTEvent).toHaveBeenCalledTimes(1);
      const target = decodeSentUpdate(mc.sendVTTEvent.mock.calls[0][3]);
      expect(target.getMap('t').get('a')).toBe(1);
      expect(target.getMap('t').get('b')).toBe(2);
      expect(target.getMap('t').get('c')).toBe(3);
    });

    it('keeps every pending update under sustained buffering (no drop-oldest)', async () => {
      transport.destroy();
      yjs = makeYjsManager();
      mc = makeMatrixClient('connecting');
      transport = new YjsMatrixTransport(mc, yjs, '!r:id');

      for (let i = 0; i < 105; i++) {
        yjs._trigger(realUpdate((d) => d.getMap('t').set(`k${i}`, i)));
      }
      await flushMicrotasks();
      mc._setStatus('connected');
      await vi.advanceTimersByTimeAsync(0);
      await flushMicrotasks();

      expect(mc.sendVTTEvent).toHaveBeenCalledTimes(1);
      const target = decodeSentUpdate(mc.sendVTTEvent.mock.calls[0][3]);
      expect(target.getMap('t').size).toBe(105);
      expect(target.getMap('t').get('k0')).toBe(0);
      expect(target.getMap('t').get('k104')).toBe(104);
    });
  });
});
