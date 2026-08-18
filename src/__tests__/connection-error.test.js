import { describe, it, expect } from 'vitest';
import { isConnectionLostError } from '../utils/connection-error.js';

describe('isConnectionLostError', () => {
  it('matches Firefox dynamic-import failure', () => {
    expect(isConnectionLostError(new TypeError(
      'error loading dynamically imported module: https://x/y.js',
    ))).toBe(true);
  });

  it('matches Chrome dynamic-import failure', () => {
    expect(isConnectionLostError(new TypeError(
      'Failed to fetch dynamically imported module: https://x/y.js',
    ))).toBe(true);
  });

  it('matches Firefox NetworkError on plain fetch', () => {
    expect(isConnectionLostError(new TypeError(
      'NetworkError when attempting to fetch resource.',
    ))).toBe(true);
  });

  it('matches Chrome "Failed to fetch"', () => {
    expect(isConnectionLostError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('matches Safari iOS "Load failed"', () => {
    expect(isConnectionLostError(new TypeError('Load failed'))).toBe(true);
  });

  it('does NOT match unrelated TypeErrors', () => {
    expect(isConnectionLostError(new TypeError(
      "Cannot read properties of undefined (reading 'foo')",
    ))).toBe(false);
  });

  it('does NOT match plain Errors', () => {
    expect(isConnectionLostError(new Error('VTT container not found'))).toBe(false);
  });

  it('handles null/undefined safely', () => {
    expect(isConnectionLostError(null)).toBe(false);
    expect(isConnectionLostError(undefined)).toBe(false);
    expect(isConnectionLostError({})).toBe(false);
    expect(isConnectionLostError({ message: 42 })).toBe(false);
  });
});
