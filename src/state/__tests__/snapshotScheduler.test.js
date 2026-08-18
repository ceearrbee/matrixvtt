/**
 * The snapshot scheduler republishes the durable Yjs snapshot after edits so
 * live changes survive reload (their update events roll off the sync window).
 * Debounced after edits settle, with a periodic safety flush, an in-flight
 * guard, and clean teardown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { startSnapshotScheduler } from '../snapshot-scheduler.js';

function makeSm() {
  const updates$ = new Subject();
  return { sm: { yjs: { updates$ } }, emit: (origin) => updates$.next({ origin }) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('startSnapshotScheduler', () => {
  it('debounces a burst of edits into a single publish', async () => {
    const { sm, emit } = makeSm();
    const publish = vi.fn().mockResolvedValue(true);
    const stop = startSnapshotScheduler(sm, { publish, debounceMs: 5000, periodicMs: 100000 });

    emit(); emit(); emit();
    expect(publish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(publish).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ignores snapshot-origin updates (applying a snapshot is not an edit)', async () => {
    const { sm, emit } = makeSm();
    const publish = vi.fn().mockResolvedValue(true);
    const stop = startSnapshotScheduler(sm, { publish, debounceMs: 5000, periodicMs: 100000 });

    emit('snapshot');
    await vi.advanceTimersByTimeAsync(5000);
    expect(publish).not.toHaveBeenCalled();
    stop();
  });

  it('periodically flushes when edits keep resetting the debounce', async () => {
    const { sm, emit } = makeSm();
    const publish = vi.fn().mockResolvedValue(true);
    // Long debounce, short periodic → the periodic safety net does the work.
    const stop = startSnapshotScheduler(sm, { publish, debounceMs: 100000, periodicMs: 1000 });

    emit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(1); // debounce hasn't fired; periodic did
    stop();
  });

  it('does not overlap publishes (in-flight guard)', async () => {
    const { sm, emit } = makeSm();
    let resolve;
    const publish = vi.fn(() => new Promise((r) => { resolve = r; }));
    const stop = startSnapshotScheduler(sm, { publish, debounceMs: 1000, periodicMs: 100000 });

    emit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(1); // first publish in flight (unresolved)

    emit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(1); // guarded - no overlap

    resolve(true);
    stop();
  });

  it('stops cleanly - no publish after dispose', async () => {
    const { sm, emit } = makeSm();
    const publish = vi.fn().mockResolvedValue(true);
    const stop = startSnapshotScheduler(sm, { publish, debounceMs: 1000, periodicMs: 2000 });

    stop();
    emit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(publish).not.toHaveBeenCalled();
  });

  it('no-ops without a Yjs updates stream', () => {
    expect(() => startSnapshotScheduler({})()).not.toThrow();
  });
});
