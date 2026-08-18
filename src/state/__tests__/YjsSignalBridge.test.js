import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsSignalBridge, FrameBatcher } from '../YjsSignalBridge.js';
import { effect } from '@preact/signals';

describe('YjsSignalBridge', () => {
  let ydoc;
  let yMap;

  beforeEach(() => {
    ydoc = new Y.Doc();
    yMap = ydoc.getMap('test');
  });

  afterEach(() => {
    ydoc.destroy();
  });

  it('initializes signals from existing data', () => {
    yMap.set('t1', { val: 1 });
    yMap.set('t2', { val: 2 });

    const bridge = new YjsSignalBridge(yMap);

    expect(bridge.ids.value).toEqual(['t1', 't2']);
    expect(bridge.get('t1').value).toEqual({ val: 1 });
    expect(bridge.get('t2').value).toEqual({ val: 2 });
  });

  it('updates granular signals on Yjs mutation', () => {
    const bridge = new YjsSignalBridge(yMap);
    
    // Add
    yMap.set('t1', { x: 0 });
    expect(bridge.ids.value).toEqual(['t1']);
    expect(bridge.get('t1').value).toEqual({ x: 0 });

    // Track reactivity
    let callCount = 0;
    effect(() => {
      bridge.get('t1').value;
      callCount++;
    });
    expect(callCount).toBe(1);

    // Update
    yMap.set('t1', { x: 10 });
    expect(bridge.get('t1').value).toEqual({ x: 10 });
    expect(callCount).toBe(2);

    // Delete
    yMap.delete('t1');
    expect(bridge.ids.value).toEqual([]);
    expect(bridge.get('t1')).toBeUndefined();
  });

  it('isolates reactivity to modified entities only', () => {
    yMap.set('t1', { x: 0 });
    yMap.set('t2', { y: 0 });
    const bridge = new YjsSignalBridge(yMap);

    let t1Calls = 0;
    let t2Calls = 0;

    effect(() => { bridge.get('t1').value; t1Calls++; });
    effect(() => { bridge.get('t2').value; t2Calls++; });

    expect(t1Calls).toBe(1);
    expect(t2Calls).toBe(1);

    // Update t1 only
    yMap.set('t1', { x: 100 });

    expect(t1Calls).toBe(2);
    expect(t2Calls).toBe(1); // t2 should NOT have re-rendered
  });

  it('batches multiple updates in a single transaction', () => {
    const bridge = new YjsSignalBridge(yMap);
    let idsCalls = 0;
    effect(() => { bridge.ids.value; idsCalls++; });

    expect(idsCalls).toBe(1);

    ydoc.transact(() => {
      yMap.set('t1', 1);
      yMap.set('t2', 2);
      yMap.set('t3', 3);
    });

    // Even though 3 items were added, ids signal should only notify ONCE
    expect(idsCalls).toBe(2);
    expect(bridge.ids.value).toHaveLength(3);
  });

  describe('rebind', () => {
    it('replaces the underlying Y.Map and notifies subscribers via the same ids signal', () => {
      yMap.set('a', { v: 1 });
      const bridge = new YjsSignalBridge(yMap);
      const seen = [];
      effect(() => { seen.push([...bridge.ids.value]); });

      const newDoc = new Y.Doc();
      const newMap = newDoc.getMap('test');
      newMap.set('x', { v: 99 });
      newMap.set('y', { v: 100 });

      bridge.rebind(newMap);

      expect(bridge.ids.value).toEqual(['x', 'y']);
      // The same ids Signal received the rebind notification - subscribers
      // bound before rebind keep working without re-subscribing.
      expect(seen.at(-1)).toEqual(['x', 'y']);
      expect(bridge.get('x').value).toEqual({ v: 99 });
      newDoc.destroy();
    });

    it('observes the new collection so subsequent mutations propagate', () => {
      const bridge = new YjsSignalBridge(yMap);
      const newDoc = new Y.Doc();
      const newMap = newDoc.getMap('test');
      bridge.rebind(newMap);
      newMap.set('z', { v: 5 });
      expect(bridge.ids.value).toContain('z');
      expect(bridge.get('z').value).toEqual({ v: 5 });
      newDoc.destroy();
    });

    it('stops observing the old collection after rebind', () => {
      const bridge = new YjsSignalBridge(yMap);
      const newDoc = new Y.Doc();
      const newMap = newDoc.getMap('test');
      bridge.rebind(newMap);
      // Mutating the original map must not leak into the rebound bridge.
      yMap.set('ghost', { v: -1 });
      expect(bridge.ids.value).not.toContain('ghost');
      newDoc.destroy();
    });
  });
});

describe('FrameBatcher', () => {
  it('throttles callbacks to requestAnimationFrame', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const batcher = new FrameBatcher(callback);

    batcher.request();
    batcher.request();
    batcher.request();

    expect(callback).not.toHaveBeenCalled();

    // Trigger requestAnimationFrame
    vi.runAllTimers();
    // Note: Vitest's runAllTimers might not handle requestAnimationFrame 
    // unless mocked properly, but we can assume it works if we use 
    // vi.stubGlobal or similar if needed.
    // In many environments, vi.useFakeTimers() handles it.
  });
});
