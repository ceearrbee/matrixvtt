/**
 * Active combatant pulse ring - the active combatant's token has a pulsing
 * outer ring while combat is active.
 *
 * getActiveCombatantRingAlpha(t) returns an alpha value in [0.4, 1.0] based
 * on elapsed time t (ms), suitable for use as globalAlpha on the ring arc.
 */

import { describe, it, expect } from 'vitest';
import { getActiveCombatantRingAlpha } from '../map/layers/tokens.js';

describe('getActiveCombatantRingAlpha', () => {
  it('returns a value in the range [0.4, 1.0]', () => {
    for (let t = 0; t < 3000; t += 50) {
      const alpha = getActiveCombatantRingAlpha(t);
      expect(alpha).toBeGreaterThanOrEqual(0.39);
      expect(alpha).toBeLessThanOrEqual(1.0);
    }
  });

  it('returns different values at different times (oscillates)', () => {
    const a0 = getActiveCombatantRingAlpha(0);
    const a500 = getActiveCombatantRingAlpha(500);
    // Over a 500 ms window the cosine-based pulse should differ
    expect(a0).not.toBeCloseTo(a500, 3);
  });

  it('is periodic - same value at t and t + full period', () => {
    // Period is 1200 ms
    const period = 1200;
    for (let t = 0; t < 2400; t += 100) {
      expect(getActiveCombatantRingAlpha(t)).toBeCloseTo(
        getActiveCombatantRingAlpha(t + period), 5
      );
    }
  });
});
