/**
 * Regression: MatrixVTTClient.destroy() must clear state collections
 * before tearing down the StateManager. Otherwise a queued retry
 * write from session N can fire against stale collections from
 * session N+1.
 */
import { describe, it, expect, vi } from 'vitest';
import { MatrixVTTClient } from '../app-client.js';

describe('MatrixVTTClient.destroy', () => {
  it('clears state collections before destroying the StateManager', () => {
    const client = new MatrixVTTClient();
    const clearAllState = vi.fn();
    const destroy = vi.fn();
    const callOrder = [];
    client.state = {
      _clearAllState: () => { callOrder.push('clear'); clearAllState(); },
      destroy: () => { callOrder.push('destroy'); destroy(); },
    };
    client.destroy();
    expect(clearAllState).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(callOrder).toEqual(['clear', 'destroy']);
    expect(client.state).toBeNull();
  });

  it('is safe when state is null', () => {
    const client = new MatrixVTTClient();
    expect(() => client.destroy()).not.toThrow();
  });
});
