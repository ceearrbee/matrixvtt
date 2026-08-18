/**
 * The Yjs drawings bridge must always leave sm.drawings as an array,
 * matching the syncer's applyDrawing(). If the bridge wrote `val` raw
 * and Yjs ever delivered null / undefined / an object wrapper, the
 * next render code's .filter() / .findIndex() would TypeError on a
 * non-array.
 *
 * This locks in the array coercion contract.
 */
import { describe, it, expect } from 'vitest';

// The bridge body, extracted as a pure function so the test can
// invoke it without mounting the full Yjs + StateManager pipeline.
function bridgeApply(sm, val) {
  sm.drawings = Array.isArray(val)
    ? val
    : (Array.isArray(val?.strokes) ? val.strokes : []);
}

describe('drawings Yjs bridge - array coercion', () => {
  it('an array passes through unchanged', () => {
    const sm = {};
    const arr = [{ id: 's1', type: 'pencil' }];
    bridgeApply(sm, arr);
    expect(sm.drawings).toBe(arr);
  });

  it('null becomes []', () => {
    const sm = {};
    bridgeApply(sm, null);
    expect(sm.drawings).toEqual([]);
    expect(Array.isArray(sm.drawings)).toBe(true);
  });

  it('undefined becomes []', () => {
    const sm = {};
    bridgeApply(sm, undefined);
    expect(sm.drawings).toEqual([]);
  });

  it('an empty object becomes [] (tombstone shape)', () => {
    const sm = {};
    bridgeApply(sm, {});
    expect(sm.drawings).toEqual([]);
  });

  it('{ strokes: [...] } unwraps the array (syncer shape)', () => {
    const sm = {};
    const inner = [{ id: 's1' }, { id: 's2' }];
    bridgeApply(sm, { strokes: inner });
    expect(sm.drawings).toBe(inner);
  });

  it('a non-array, non-strokes object becomes [] (defensive)', () => {
    const sm = {};
    bridgeApply(sm, { foo: 'bar' });
    expect(sm.drawings).toEqual([]);
  });

  it('renderers can safely call .filter() after every bridge write', () => {
    const sm = {};
    for (const val of [null, undefined, {}, [{}], { strokes: [{}] }, 'garbage', 42]) {
      bridgeApply(sm, val);
      expect(() => sm.drawings.filter(() => true)).not.toThrow();
    }
  });
});
