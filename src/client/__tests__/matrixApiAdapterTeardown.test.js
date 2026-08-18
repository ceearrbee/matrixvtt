/**
 * MatrixApiAdapter registers three SDK listeners (RoomState.events,
 * Room.timeline, sync) in its constructor. stopSync() must deregister them -
 * otherwise switching rooms / re-initing against a reused sdk leaks listeners
 * that keep firing and double-process events.
 */
import { describe, it, expect, vi } from 'vitest';
import { MatrixApiAdapter } from '../MatrixApiAdapter.js';

function makeMatrixClient() {
  const sdk = { on: vi.fn(), off: vi.fn(), getRoom: vi.fn(() => null) };
  return { sdk, userId: '@p:hs', status: 'connected', onStatusUpdate: vi.fn(() => () => {}) };
}

describe('MatrixApiAdapter teardown', () => {
  it('registers three SDK listeners on construct and removes them on stopSync', () => {
    const mc = makeMatrixClient();
    const adapter = new MatrixApiAdapter(mc, '!r:hs');

    const onTypes = mc.sdk.on.mock.calls.map((c) => c[0]).sort();
    expect(onTypes).toEqual(['Room.timeline', 'RoomState.events', 'sync'].sort());

    adapter.stopSync();

    // Each registered handler is deregistered with the SAME function ref.
    for (const [type, handler] of mc.sdk.on.mock.calls) {
      expect(mc.sdk.off).toHaveBeenCalledWith(type, handler);
    }
    expect(mc.sdk.off).toHaveBeenCalledTimes(3);
  });
});
