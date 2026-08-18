/**
 * Turn timer - startTurnTimer / stopTurnTimer
 *
 * startTurnTimer() starts a 1-second interval that writes elapsed time
 * (M:SS format) to #turn-timer. stopTurnTimer() clears the interval
 * and resets the timer state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startTurnTimer, stopTurnTimer } from '../ui/tab-navigation.js';

function makeUi() {
  return { _turnStartMs: null, _turnTimerInterval: null };
}

describe('turn timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets _turnStartMs to current time when started', () => {
    const ui = makeUi();
    const before = Date.now();
    startTurnTimer(ui);
    stopTurnTimer(ui);
    expect(ui._turnStartMs).toBeNull(); // stopped - but was set
    // Re-start to verify the value is set
    const now = Date.now();
    startTurnTimer(ui);
    expect(ui._turnStartMs).toBeGreaterThanOrEqual(now);
    stopTurnTimer(ui);
  });

  it('updates #turn-timer element with elapsed time each second', () => {
    const ui = makeUi();
    const el = document.createElement('span');
    el.id = 'turn-timer';
    document.body.appendChild(el);

    try {
      startTurnTimer(ui);
      vi.advanceTimersByTime(65000); // 1 min 5 sec
      expect(el.textContent).toBe('1:05');
    } finally {
      stopTurnTimer(ui);
      document.body.removeChild(el);
    }
  });

  it('formats seconds under 10 with a leading zero', () => {
    const ui = makeUi();
    const el = document.createElement('span');
    el.id = 'turn-timer';
    document.body.appendChild(el);

    try {
      startTurnTimer(ui);
      vi.advanceTimersByTime(7000); // 7 seconds
      expect(el.textContent).toBe('0:07');
    } finally {
      stopTurnTimer(ui);
      document.body.removeChild(el);
    }
  });

  it('clears the interval and resets state on stop', () => {
    const ui = makeUi();
    startTurnTimer(ui);
    expect(ui._turnTimerInterval).not.toBeNull();
    stopTurnTimer(ui);
    expect(ui._turnTimerInterval).toBeNull();
    expect(ui._turnStartMs).toBeNull();
  });

  it('does not throw when #turn-timer element is absent', () => {
    const ui = makeUi();
    startTurnTimer(ui);
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    stopTurnTimer(ui);
  });
});
