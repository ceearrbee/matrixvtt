/**
 * SubscriptionManager must accept Preact signals as well as RxJS
 * Observables. The Yjs-bridge code in stateManager-yjs-bridges.js
 * passes `bridge.ids` (a `signal(...)`) directly to subscribe() -
 * a signal has `.subscribe(fn)` but no `.pipe()`, so the manager
 * must branch on the source shape rather than blindly piping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';
import { SubscriptionManager } from '../SubscriptionManager.js';

describe('SubscriptionManager - Preact signal sources', () => {
  let sm;
  beforeEach(() => { sm = new SubscriptionManager(); });
  afterEach(() => { sm.destroy(); });

  it('subscribes to a signal: priming run + propagation on .value writes', () => {
    const s = signal(['a']);
    const onNext = vi.fn();
    sm.subscribe('signal-a', s, onNext);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenLastCalledWith(['a']);

    s.value = ['a', 'b'];
    expect(onNext).toHaveBeenCalledTimes(2);
    expect(onNext).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('unsubscribe(name) stops further onNext calls for a signal source', () => {
    const s = signal(0);
    const onNext = vi.fn();
    sm.subscribe('signal-b', s, onNext);

    onNext.mockClear();
    sm.unsubscribe('signal-b');
    s.value = 99;

    expect(onNext).not.toHaveBeenCalled();
  });

  it('reusing the same name swaps handlers (idempotent like the Observable path)', () => {
    const s = signal('initial');
    const first = vi.fn();
    const second = vi.fn();

    sm.subscribe('shared', s, first);
    first.mockClear();
    sm.subscribe('shared', s, second);

    s.value = 'updated';
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('updated');
  });

  it('destroy() unsubscribes signal-backed entries', () => {
    const s = signal(1);
    const onNext = vi.fn();
    sm.subscribe('signal-c', s, onNext);

    onNext.mockClear();
    sm.destroy();
    s.value = 2;

    expect(onNext).not.toHaveBeenCalled();
    // Re-create so the afterEach destroy() doesn't double-destroy
    sm = new SubscriptionManager();
  });
});
