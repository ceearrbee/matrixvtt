/**
 * sendStateEvent - 65 KB size guard
 *
 * Matrix state events have a hard 65 536-byte server limit.
 * sendStateEvent() must reject payloads that exceed 63 000 bytes
 * before attempting a network send.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendStateEvent } from '../state/syncer.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeSm() {
  return {
    widgetManager: {
      sendStateEvent: vi.fn().mockResolvedValue({}),
      getRateLimitWait: vi.fn().mockReturnValue(0),
      isStandalone: false,
    },
    lastSentState: new Map(),
    _retryQueue: new Map(),
    _drainTimer: null,
  };
}

/** Build a fog event whose JSON byte-length exceeds the 63 KB guard. */
function oversizedFog() {
  // 10 000 cells × ~9 bytes each ≈ 90 KB - well above the 63 000-byte limit.
  return {
    mode: 'hidden',
    revealed: Array.from({ length: 10000 }, (_, i) => `${i % 100},${Math.floor(i / 100)}`)
  };
}

/** Build a fog event whose JSON byte-length is safely under the limit. */
function smallFog() {
  return { mode: 'hidden', revealed: ['0,0', '1,0', '2,0'] };
}

describe('sendStateEvent - 65 KB size guard', () => {
  let sm;
  beforeEach(() => { sm = makeSm(); });

  it('throws when content JSON exceeds 63 000 bytes', async () => {
    await expect(sendStateEvent(sm, EVENT_TYPES.FOG, '', oversizedFog()))
      .rejects.toThrow(/too large|63.?[Kk]/);
  });

  it('does not call widgetManager.sendStateEvent for oversized content', async () => {
    await sendStateEvent(sm, EVENT_TYPES.FOG, '', oversizedFog()).catch(() => {});
    expect(sm.widgetManager.sendStateEvent).not.toHaveBeenCalled();
  });

  it('succeeds and sends when content is under 63 000 bytes', async () => {
    await expect(sendStateEvent(sm, EVENT_TYPES.FOG, '', smallFog()))
      .resolves.not.toThrow();
    expect(sm.widgetManager.sendStateEvent).toHaveBeenCalledOnce();
  });

  it('error message includes the measured KB size', async () => {
    let message = '';
    await sendStateEvent(sm, EVENT_TYPES.FOG, '', oversizedFog()).catch(e => { message = e.message; });
    expect(message).toMatch(/\d+\s*KB/i);
  });
});
