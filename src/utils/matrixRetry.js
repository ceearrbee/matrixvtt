/**
 * Retry wrapper for Matrix API calls that hit M_LIMIT_EXCEEDED (HTTP 429).
 *
 * Respects the server-supplied `retry_after_ms` when present, else uses
 * exponential backoff starting at 500 ms. Gives up after `maxAttempts`.
 * Non-429 errors bubble up on the first try - only rate limits retry.
 *
 * Backed by `p-retry` for the retry-loop machinery; the project-specific
 * bits (recognising the Matrix 429 shape, honouring `retry_after_ms`)
 * stay here so the call surface (`retryOnRateLimit(fn, opts)`) is
 * unchanged from the previous hand-rolled implementation.
 */

import pRetry from 'p-retry';

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;

export function isRateLimitError(error) {
  if (!error) return false;
  // Matrix JS SDK exposes `httpStatus` or `errcode`; the widget API just
  // throws a plain error whose `status` field is the HTTP code.
  return error.status === 429
      || error.httpStatus === 429
      || error.errcode === 'M_LIMIT_EXCEEDED';
}

function retryDelayMs(error, attempt, baseDelay) {
  const server = Number(error?.data?.retry_after_ms ?? error?.retry_after_ms);
  if (Number.isFinite(server) && server > 0) return server;
  // Exponential backoff: base, 2·base, 4·base, …
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Invoke `fn()` and retry on 429 with server-hinted or exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{maxAttempts?: number, baseDelayMs?: number}} [opts]
 * @returns {Promise<T>}
 */
export async function retryOnRateLimit(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelay   = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  return pRetry(fn, {
    retries: maxAttempts - 1,
    // Disable p-retry's own backoff schedule; we drive every wait
    // ourselves in `onFailedAttempt` so the server's `retry_after_ms`
    // hint takes precedence over any built-in formula.
    minTimeout: 0,
    maxTimeout: 0,
    factor: 1,
    shouldRetry: ({ error }) => isRateLimitError(error),
    onFailedAttempt: async ({ error, attemptNumber }) => {
      if (!isRateLimitError(error)) return;
      const wait = retryDelayMs(error, attemptNumber - 1, baseDelay);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    },
  });
}
