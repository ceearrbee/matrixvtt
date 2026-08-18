/**
 * Queue retry detection - matrix-js-sdk MatrixError uses `httpStatus`,
 * not `status`. Our `_isRetriable` test was reading `err?.status`,
 * which is `undefined` on real MatrixError instances. Result: every
 * 429 / 5xx came back as fatal and the call site bailed instead of
 * the queue parking the write for a 2s retry.
 *
 * Observed in the wild: a chunked Yjs snapshot publish hit rate limit
 * on its second chunk, threw at publishYjsSnapshot, and surfaced as
 * "Couldn't save the campaign snapshot to the server" right after
 * wizard setup.
 *
 * `sendStateEvent`'s contract for retriable errors: enqueue the write,
 * don't throw. The caller's await resolves to undefined.
 */
import { describe, it, expect, vi } from 'vitest';
import { sendStateEvent } from '../state/queue.js';
import { EVENT_TYPES } from '../utils/constants.js';

function mkSm({ sendImpl }) {
  return {
    settings: { gm_user_ids: ['@gm:m'] },
    widgetManager: {
      userId: '@gm:m',
      sendStateEvent: sendImpl,
    },
    lastSentState: new Map(),
    powerLevels: null,
    _retryQueue: new Map(),
    _drainTimer: null,
  };
}

function matrixError(httpStatus, message = 'Too Many Requests') {
  const err = new Error(`MatrixError: [${httpStatus}] ${message}`);
  err.httpStatus = httpStatus;
  return err;
}

describe('queue._isRetriable - recognises matrix-js-sdk httpStatus', () => {
  it('429 from MatrixError parks the write in the queue (no throw)', async () => {
    const send = vi.fn().mockRejectedValueOnce(matrixError(429));
    const sm = mkSm({ sendImpl: send });
    // No throw expected - the queue absorbs the rate limit.
    await sendStateEvent(sm, EVENT_TYPES.UI_MODE, '', { mode: 'combat' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('500 from MatrixError parks the write in the queue (no throw)', async () => {
    const send = vi.fn().mockRejectedValueOnce(matrixError(503));
    const sm = mkSm({ sendImpl: send });
    await sendStateEvent(sm, EVENT_TYPES.UI_MODE, '', { mode: 'combat' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('403 from MatrixError still throws (non-retriable, surface to user)', async () => {
    const send = vi.fn().mockRejectedValue(matrixError(403, 'Forbidden'));
    const sm = mkSm({ sendImpl: send });
    await expect(
      sendStateEvent(sm, EVENT_TYPES.UI_MODE, '', { mode: 'combat' }),
    ).rejects.toThrow();
  });

  it('legacy err.status path still works (defensive)', async () => {
    // Some upstream errors set `.status` instead of `.httpStatus`. Both
    // shapes must be recognised so the queue can't regress to fatal-by-
    // accident if a wrapped error loses one of the fields.
    const err = new Error('rate-limited');
    err.status = 429;
    const send = vi.fn().mockRejectedValueOnce(err);
    const sm = mkSm({ sendImpl: send });
    await sendStateEvent(sm, EVENT_TYPES.UI_MODE, '', { mode: 'combat' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
