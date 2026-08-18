/**
 * `_turnTimerInterval` is created by
 * `startTurnTimer` (tab-navigation.js) and cleared per-turn by
 * `stopTurnTimer`, but if a user signs out or leaves mid-turn the
 * interval keeps polling the (now removed) #turn-timer DOM node and
 * leaks across the session boundary. `destroyUI` must clear it.
 */
import { describe, it, expect, vi } from 'vitest';
import { destroyUI } from '../ui/lifecycle-init.js';

function makeUi(turnTimerInterval) {
  return {
    _seenLogEventIds: new Set(),
    _disposeStateEffects: null,
    _rateLimitInterval: null,
    _debugBarInterval: null,
    _syncDisplayNameTimer: null,
    _turnTimerInterval: turnTimerInterval,
    handleDiceRollResult: () => {}, handleDamage: () => {}, handleHeal: () => {},
    handleViewSheet: () => {}, _onError: () => {}, _onSessionReset: () => {},
    _onRateLimited: () => {}, _onQueuePending: () => {}, _onQueueEmpty: () => {},
    _onChat: () => {}, _onTyping: () => {},
    mapRenderer: { destroy: vi.fn() },
  };
}

describe('destroyUI clears _turnTimerInterval', () => {
  it('stops the per-second turn-timer poll if signed out mid-turn', () => {
    let ticked = 0;
    const id = setInterval(() => { ticked++; }, 1);
    const ui = makeUi(id);
    destroyUI(ui);
    const startTicks = ticked;
    return new Promise((resolve) => setTimeout(() => {
      expect(ticked).toBe(startTicks);
      expect(ui._turnTimerInterval).toBeNull();
      resolve();
    }, 20));
  });
});
