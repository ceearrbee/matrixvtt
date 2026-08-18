/**
 * Tour/welcome sequencing: when the driver tour and the welcome handout
 * would both fire on first entry into a room, they must NOT stack on
 * top of each other. The tour runs first; the welcome handout opens
 * after the tour is dismissed (or immediately if the tour is already
 * completed). The visible failure is two welcome modals stacking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeAutoStartTour, clearTourCompletion, markTourCompleted } from '../ui/onboarding-tour.js';

vi.mock('driver.js', () => ({
  driver: vi.fn(({ onDestroyed }) => ({
    drive: vi.fn(() => {
      globalThis.__lastTourOnDestroyed = onDestroyed;
    }),
  })),
}));

describe('maybeAutoStartTour - onAfterTour continuation', () => {
  beforeEach(() => {
    clearTourCompletion();
    globalThis.__lastTourOnDestroyed = null;
    document.body.innerHTML = '<div id="map-canvas"></div>';
  });

  it('runs onAfterTour after the tour is destroyed', async () => {
    const onAfterTour = vi.fn();
    maybeAutoStartTour({ onAfterTour });

    // The tour arms after a double rAF plus a lazy runtime import.
    await vi.waitFor(() => {
      expect(globalThis.__lastTourOnDestroyed).toBeTypeOf('function');
    });
    expect(onAfterTour).not.toHaveBeenCalled();

    globalThis.__lastTourOnDestroyed();
    expect(onAfterTour).toHaveBeenCalledOnce();
  });

  it('runs onAfterTour immediately when the tour is already completed', () => {
    markTourCompleted();
    const onAfterTour = vi.fn();
    maybeAutoStartTour({ onAfterTour });
    expect(onAfterTour).toHaveBeenCalledOnce();
  });

  it('with no onAfterTour, behaves as before (no throw, no change)', () => {
    expect(() => maybeAutoStartTour()).not.toThrow();
  });
});
