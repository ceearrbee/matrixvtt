/**
 * Regression: ui._seenLogEventIds tracks message event_ids that have
 * been logged so duplicates are skipped. It must be cleared on UI
 * destroy so a subsequent user (after sign-out + sign-in on the same
 * tab) doesn't silently miss messages whose event_ids overlap.
 */
import { describe, it, expect, vi } from 'vitest';
import { destroyUI } from '../ui/lifecycle-init.js';

function makeUi() {
  return {
    _seenLogEventIds: new Set(['old-event-1', 'old-event-2']),
    _disposeStateEffects: null,
    _rateLimitInterval: null,
    _debugBarInterval: null,
    _syncDisplayNameTimer: null,
    handleDiceRollResult: () => {}, handleDamage: () => {}, handleHeal: () => {},
    handleViewSheet: () => {}, _onError: () => {}, _onSessionReset: () => {},
    _onRateLimited: () => {}, _onQueuePending: () => {}, _onQueueEmpty: () => {},
    _onChat: () => {}, _onTyping: () => {},
    mapRenderer: { destroy: vi.fn() },
  };
}

describe('destroyUI clears _seenLogEventIds', () => {
  it('resets the dedup set so a new user does not inherit old event_ids', () => {
    const ui = makeUi();
    destroyUI(ui);
    expect(ui._seenLogEventIds.size).toBe(0);
  });
});
