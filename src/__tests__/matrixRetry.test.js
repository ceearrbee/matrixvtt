/**
 * retryOnRateLimit wraps a Matrix call so 429 responses back off and retry
 * instead of propagating. Non-429 errors still bubble out immediately.
 */

import { describe, it, expect, vi } from 'vitest';
import { retryOnRateLimit } from '../utils/matrixRetry.js';

describe('retryOnRateLimit', () => {
  it('returns the result on first success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryOnRateLimit(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on HTTP 429 and succeeds on the follow-up attempt', async () => {
    const rateLimit = Object.assign(new Error('Too Many Requests'), {
      status: 429, errcode: 'M_LIMIT_EXCEEDED',
    });
    const fn = vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce('ok');
    const result = await retryOnRateLimit(fn, { baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on Matrix httpStatus: 429 shape (JS SDK style)', async () => {
    const rateLimit = Object.assign(new Error('rate'), { httpStatus: 429 });
    const fn = vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce('done');
    const result = await retryOnRateLimit(fn, { baseDelayMs: 0 });
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates non-429 errors immediately without retry', async () => {
    const err = Object.assign(new Error('nope'), { status: 403, errcode: 'M_FORBIDDEN' });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryOnRateLimit(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and throws the last 429', async () => {
    const err = Object.assign(new Error('rate'), { status: 429 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryOnRateLimit(fn, { maxAttempts: 3, baseDelayMs: 0 }))
      .rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honours server-supplied retry_after_ms', async () => {
    const hint = 25;
    const started = Date.now();
    const rateLimit = Object.assign(new Error('rate'), {
      status: 429, data: { retry_after_ms: hint },
    });
    const fn = vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce('ok');
    await retryOnRateLimit(fn, { baseDelayMs: 1 });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(hint - 5); // small scheduler slack
  });
});
