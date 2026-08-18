/**
 * HP zone classification is the
 * basis for color-blind-safe styling via [data-zone] CSS selectors.
 * Thresholds are presentation breakpoints (50% / 25%), not rule data,
 * so they live in utils, not in the active ruleset.
 */
import { describe, it, expect } from 'vitest';
import { HP_ZONES, getHPZone } from '../utils/format.js';

describe('HP zones', () => {
  it('exposes named thresholds', () => {
    expect(HP_ZONES.HEALTHY).toBe(0.5);
    expect(HP_ZONES.WOUNDED).toBe(0.25);
  });

  it('classifies above 50% as healthy', () => {
    expect(getHPZone({ hp_current: 30, hp_max: 50 })).toBe('healthy');
    expect(getHPZone({ hp_current: 50, hp_max: 50 })).toBe('healthy');
  });

  it('classifies 25–50% as wounded', () => {
    expect(getHPZone({ hp_current: 20, hp_max: 50 })).toBe('wounded');
    expect(getHPZone({ hp_current: 13, hp_max: 50 })).toBe('wounded');
  });

  it('classifies below 25% as critical', () => {
    expect(getHPZone({ hp_current: 5, hp_max: 50 })).toBe('critical');
    expect(getHPZone({ hp_current: 0, hp_max: 50 })).toBe('critical');
  });

  it('returns "unknown" for missing/zero hp_max', () => {
    expect(getHPZone({})).toBe('unknown');
    expect(getHPZone({ hp_current: 5, hp_max: 0 })).toBe('unknown');
  });
});
