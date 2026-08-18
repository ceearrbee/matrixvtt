import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsManager } from '../YjsManager.js';

describe('YjsManager', () => {
  let manager;
  const roomId = '!room:id';

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new YjsManager(roomId);
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.destroy();
  });

  describe('Distributed Integrity: Chunking & Reassembly', () => {
    it('atomically reassembles and applies chunked updates', () => {
      // 1. Create a real Yjs update
      const remoteDoc = new Y.Doc();
      const remoteMap = remoteDoc.getMap('tokens');
      remoteMap.set('t1', { x: 10, y: 20 });
      const update = Y.encodeStateAsUpdate(remoteDoc);

      // 2. Split into chunks
      const chunk1 = update.slice(0, update.length / 2);
      const chunk2 = update.slice(update.length / 2);

      const sequenceId = 'seq-123';
      
      // 3. Handle chunks out of order
      manager.handleMatrixUpdate({ sequenceId, index: 1, total: 2, data: Array.from(chunk2) });
      expect(manager.tokens.get('t1')).toBeUndefined(); // Partial data not applied

      manager.handleMatrixUpdate({ sequenceId, index: 0, total: 2, data: Array.from(chunk1) });
      
      // 4. Verify reassembly
      expect(manager.tokens.get('t1').value).toEqual({ x: 10, y: 20 });
    });

    it('discards incomplete chunk sequences after timeout', () => {
      const sequenceId = 'stale-seq';
      manager.handleMatrixUpdate({ sequenceId, index: 0, total: 2, data: [1, 2, 3] });
      
      expect(manager._reassemblyBuffers.has(sequenceId)).toBe(true);
      
      vi.advanceTimersByTime(31000); // Exceed 30s timeout
      // Advance by interval tick (10s)
      vi.advanceTimersByTime(10000);

      expect(manager._reassemblyBuffers.has(sequenceId)).toBe(false);
    });

    it('enforces buffer bounds with eviction', () => {
      // Fill to max buffer size (100)
      for (let i = 0; i < 100; i++) {
        manager.handleMatrixUpdate({ sequenceId: `s${i}`, index: 0, total: 2, data: [i] });
      }
      expect(manager._reassemblyBuffers.size).toBe(100);

      // Add one more, should evict oldest (s0)
      manager.handleMatrixUpdate({ sequenceId: 'new', index: 0, total: 2, data: [255] });
      expect(manager._reassemblyBuffers.size).toBe(100);
      expect(manager._reassemblyBuffers.has('s0')).toBe(false);
      expect(manager._reassemblyBuffers.has('new')).toBe(true);
    });
  });

  describe('Causality & Convergence: Snapshots & Partitions', () => {
    it('overrides local state with authoritative snapshot baseline', () => {
      // 1. Local has some state
      manager.tokensMap.set('t1', { x: 0 });

      // 2. Prepare snapshot from "canonical" source
      const snapDoc = new Y.Doc();
      snapDoc.getMap('tokens').set('t1', { x: 100 });
      const snapshot = Y.encodeStateAsUpdate(snapDoc);

      // 3. Load snapshot with marker
      manager.loadSnapshot(snapshot, 1000);

      expect(manager.tokens.get('t1').value).toEqual({ x: 100 });
    });

    it('preserves bridge.ids subscribers across loadSnapshot (rebind, not replace)', () => {
      const observed = [];
      const tokensRef = manager.tokens; // capture pre-snapshot reference
      const idsRef = manager.tokens.ids;
      manager.tokens.ids.subscribe((ids) => observed.push([...ids]));

      const snapDoc = new Y.Doc();
      snapDoc.getMap('tokens').set('alpha', { x: 1 });
      snapDoc.getMap('tokens').set('beta', { x: 2 });
      manager.loadSnapshot(Y.encodeStateAsUpdate(snapDoc), 1000);

      // Same bridge instance and same ids signal - subscribers stay live.
      expect(manager.tokens).toBe(tokensRef);
      expect(manager.tokens.ids).toBe(idsRef);
      expect(observed.at(-1).sort()).toEqual(['alpha', 'beta']);
    });

    it('merges states after network partition', () => {
      const clientA = manager;
      const clientB = new YjsManager(roomId);

      // Sync initial state
      const initial = Y.encodeStateAsUpdate(clientA.doc);
      Y.applyUpdate(clientB.doc, initial);

      // Partition: A and B both edit
      clientA.tokensMap.set('a', 1);
      clientB.tokensMap.set('b', 2);

      // Reconnect: exchange updates
      const updateA = Y.encodeStateAsUpdate(clientA.doc);
      const updateB = Y.encodeStateAsUpdate(clientB.doc);

      Y.applyUpdate(clientA.doc, updateB);
      Y.applyUpdate(clientB.doc, updateA);

      // Verify convergence
      expect(clientA.tokens.get('a').value).toBe(1);
      expect(clientA.tokens.get('b').value).toBe(2);
      expect(clientB.tokens.get('a').value).toBe(1);
      expect(clientB.tokens.get('b').value).toBe(2);
    });
  });

  describe('Transport Boundary: Idempotency', () => {
    it('does not re-apply duplicate full updates', () => {
      const remoteDoc = new Y.Doc();
      remoteDoc.getMap('tokens').set('t1', 1);
      const update = Y.encodeStateAsUpdate(remoteDoc);

      const spy = vi.spyOn(manager.doc, 'transact'); // Internal Yjs apply path

      manager._applyValidatedUpdate(update);
      const firstCallCount = spy.mock.calls.length;

      // Re-apply same update
      manager._applyValidatedUpdate(update);
      
      expect(manager.tokens.get('t1').value).toBe(1);
    });

    it('emits local updates to transport but ignores remote ones', () => {
      const transportSpy = vi.fn();
      manager.onUpdate(transportSpy);

      // Local update
      manager.tokensMap.set('local', true);
      expect(transportSpy).toHaveBeenCalledTimes(1);

      // Remote update applied via internal method
      const remoteDoc = new Y.Doc();
      remoteDoc.getMap('tokens').set('remote', true);
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
      
      Y.applyUpdate(manager.doc, remoteUpdate, 'remote');
      
      // Should NOT trigger transport send (prevents echo loop)
      expect(transportSpy).toHaveBeenCalledTimes(1);
    });
  });
});
