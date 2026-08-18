/**
 * Generic harm applier - routes damage according to the ruleset's
 * declared harm_model. Four supported types cover the target systems:
 *
 *   pool    - single HP pool (5e, OSR)
 *   tracks  - multiple named tracks (GURPS HP+FP)
 *   stress  - FATE stress boxes (check the smallest unchecked box ≥ amt)
 *   wounds  - discrete wound slots at thresholds (Rolemaster-ish)
 *
 * Pure function: returns a new entity; input is not mutated.
 */

import { describe, it, expect } from 'vitest';
import { applyHarm } from '../engine/applyHarm.js';

describe('applyHarm - pool (5e / OSR)', () => {
  const model = { type: 'pool', track_key: 'hp' };

  it('subtracts amount from the named track', () => {
    const out = applyHarm(model, { hp: { current: 30, max: 30 } }, 10);
    expect(out.hp.current).toBe(20);
  });

  it('clamps at 0 (no negative HP)', () => {
    const out = applyHarm(model, { hp: { current: 5, max: 30 } }, 20);
    expect(out.hp.current).toBe(0);
  });

  it('tracks overflow so callers can trigger massive-damage rules', () => {
    const out = applyHarm(model, { hp: { current: 5, max: 30 } }, 20);
    expect(out.hp.overflow).toBe(15);
  });

  it('does not mutate input', () => {
    const entity = { hp: { current: 30, max: 30 } };
    applyHarm(model, entity, 10);
    expect(entity.hp.current).toBe(30);
  });
});

describe('applyHarm - tracks (GURPS HP+FP)', () => {
  const model = { type: 'tracks', tracks: ['hp', 'fp'] };

  it('routes damage to the named track', () => {
    const entity = { hp: { current: 10 }, fp: { current: 10 } };
    const out = applyHarm(model, entity, 3, 'hp');
    expect(out.hp.current).toBe(7);
    expect(out.fp.current).toBe(10);
  });

  it('fatigue damage goes to the fp track', () => {
    const entity = { hp: { current: 10 }, fp: { current: 10 } };
    const out = applyHarm(model, entity, 4, 'fp');
    expect(out.fp.current).toBe(6);
    expect(out.hp.current).toBe(10);
  });

  it('ignores damage to unknown track kinds', () => {
    const entity = { hp: { current: 10 }, fp: { current: 10 } };
    const out = applyHarm(model, entity, 5, 'mana');
    expect(out).toEqual(entity);
  });
});

describe('applyHarm - stress (FATE)', () => {
  const model = {
    type: 'stress',
    boxes: [1, 2, 3, 4], // capacities
  };

  it('checks the smallest unchecked box with capacity ≥ shift', () => {
    const entity = { stress: [false, false, false, false] };
    const out = applyHarm(model, entity, 2);
    expect(out.stress).toEqual([false, true, false, false]);
  });

  it('jumps to a larger box when the best-fit is already checked', () => {
    const entity = { stress: [false, true, false, false] };
    const out = applyHarm(model, entity, 2);
    expect(out.stress).toEqual([false, true, true, false]);
  });

  it('marks "taken_out" when no suitable box exists', () => {
    const entity = { stress: [true, true, true, true] };
    const out = applyHarm(model, entity, 3);
    expect(out.takenOut).toBe(true);
  });

  it('shift of 1 uses the 1-box', () => {
    const entity = { stress: [false, false, false, false] };
    const out = applyHarm(model, entity, 1);
    expect(out.stress).toEqual([true, false, false, false]);
  });
});

describe('applyHarm - wounds (Rolemaster-ish)', () => {
  const model = {
    type: 'wounds',
    thresholds: [
      { tier: 'light',    max: 4 },
      { tier: 'serious',  max: 8 },
      { tier: 'critical', max: Infinity },
    ],
  };

  it('light wound for small damage', () => {
    const out = applyHarm(model, { wounds: [] }, 3);
    expect(out.wounds).toEqual([{ tier: 'light', amount: 3 }]);
  });

  it('serious wound for mid damage', () => {
    const out = applyHarm(model, { wounds: [] }, 6);
    expect(out.wounds).toEqual([{ tier: 'serious', amount: 6 }]);
  });

  it('critical wound for high damage', () => {
    const out = applyHarm(model, { wounds: [] }, 20);
    expect(out.wounds).toEqual([{ tier: 'critical', amount: 20 }]);
  });

  it('appends to existing wounds without clobbering', () => {
    const existing = [{ tier: 'light', amount: 3 }];
    const out = applyHarm(model, { wounds: existing }, 6);
    expect(out.wounds).toHaveLength(2);
    expect(out.wounds[0]).toEqual({ tier: 'light', amount: 3 });
    expect(out.wounds[1].tier).toBe('serious');
  });
});

describe('applyHarm - safety', () => {
  it('returns entity unchanged when harm_model is missing', () => {
    const entity = { hp: { current: 10 } };
    expect(applyHarm(null, entity, 5)).toEqual(entity);
    expect(applyHarm({}, entity, 5)).toEqual(entity);
  });

  it('zero or negative amount is a no-op', () => {
    const entity = { hp: { current: 10, max: 10 } };
    const model = { type: 'pool', track_key: 'hp' };
    expect(applyHarm(model, entity, 0)).toEqual(entity);
    expect(applyHarm(model, entity, -3)).toEqual(entity);
  });
});
