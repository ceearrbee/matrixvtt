/**
 * Proof of genericity: drive three radically different game systems
 * through the same engine with no code changes between them.
 *
 * If this file compiles and passes, the spec and engine are truly
 * system-agnostic - every system-specific difference lives in JSON.
 */

import { describe, it, expect } from 'vitest';
import dnd5e from '../content/rulesets/dnd5e.json';
import fate from '../content/rulesets/fate.json';
import gurps from '../content/rulesets/gurps.json';
import ose from '../content/rulesets/ose.json';
import pbta from '../content/rulesets/pbta.json';
import wod from '../content/rulesets/wod.json';
import opend6 from '../content/rulesets/opend6.json';
import risus from '../content/rulesets/risus.json';
import savageWorlds from '../content/rulesets/savage-worlds.json';
import { validateRuleset } from '../engine/validateRuleset.js';
import { computeDerived } from '../engine/computeDerived.js';
import { evaluate } from '../engine/evaluate.js';
import { rollNotation } from '../engine/roll.js';
import { applyHarm } from '../engine/applyHarm.js';

const seqRng = (vals) => {
  let i = 0;
  return () => {
    const v = vals[i % vals.length];
    i += 1;
    return v;
  };
};

describe('engine drives three systems from JSON alone', () => {
  it('each ruleset conforms to the minimal required shape', () => {
    for (const rs of [dnd5e, fate, gurps, ose, pbta, wod, opend6, risus, savageWorlds]) {
      expect(rs.meta?.name).toBeTruthy();
      expect(Array.isArray(rs.attributes)).toBe(true);
      expect(rs.attributes.length).toBeGreaterThan(0);
      expect(rs.dice?.check).toBeTruthy();
    }
  });

  it('every shipped fixture passes validateRuleset', () => {
    for (const rs of [dnd5e, fate, gurps, ose, pbta, wod, opend6, risus, savageWorlds]) {
      const check = validateRuleset(rs);
      expect(check.valid, `${rs.meta.name}: ${check.errors.join(', ')}`).toBe(true);
    }
  });

  it('OSR: ability_mod is table-driven (lookup), not a formula', () => {
    // OSE uses a specific ability-score table - not the 5e floor((score-10)/2)
    expect(computeDerived(ose, 'ability_mod', { score: 3 })).toBe(-3);
    expect(computeDerived(ose, 'ability_mod', { score: 10 })).toBe(0);
    expect(computeDerived(ose, 'ability_mod', { score: 18 })).toBe(3);
  });

  it('OSR: class attack bonus comes from a class-specific table', () => {
    expect(computeDerived(ose, 'attack_bonus_fighter', { level: 1 })).toBe(0);
    expect(computeDerived(ose, 'attack_bonus_fighter', { level: 7 })).toBe(3);
    expect(computeDerived(ose, 'attack_bonus_fighter', { level: 14 })).toBe(7);
  });

  it('OSR: saves are named categories (not ability-derived)', () => {
    expect(ose.saves.map((s) => s.key))
      .toEqual(['death', 'wands', 'paralysis', 'breath', 'spells']);
  });

  it('5e rolls d20, FATE rolls 4dF, GURPS rolls 3d6 - same roller', () => {
    const rng = seqRng([0.5]);
    const rollD20  = rollNotation(dnd5e.dice.check, { rng: seqRng([0.5]) });
    const roll4dF  = rollNotation(fate.dice.check,  { rng: seqRng([0.0, 0.5, 0.8, 0.5]) });
    const roll3d6  = rollNotation(gurps.dice.check, { rng: seqRng([0.5, 0.5, 0.5]) });

    expect(rollD20.notation).toBe('1d20');
    expect(rollD20.rolls).toHaveLength(1);

    expect(roll4dF.notation).toBe('4df');
    expect(roll4dF.rolls).toEqual([-1, 0, 1, 0]);

    expect(roll3d6.notation).toBe('3d6');
    expect(roll3d6.rolls).toHaveLength(3);
  });

  it('harm models: 5e pool vs GURPS tracks vs FATE stress', () => {
    // 5e: HP pool, single track
    const dm = applyHarm(dnd5e.harm_model, { hp: { current: 30 } }, 10);
    expect(dm.hp.current).toBe(20);

    // GURPS: fatigue-only damage leaves HP alone
    const gurpsChar = { hp: { current: 12 }, fp: { current: 12 } };
    const gm = applyHarm(gurps.harm_model, gurpsChar, 4, 'fp');
    expect(gm.fp.current).toBe(8);
    expect(gm.hp.current).toBe(12);

    // FATE: shift 2 checks the 2-box (index 1)
    const fm = applyHarm(fate.harm_model, { stress: [false, false, false] }, 2);
    expect(fm.stress).toEqual([false, true, false]);
  });

  it('formula evaluation: 5e PB + mod vs GURPS success-check', () => {
    // 5e: spell_save_dc with level 5 wizard, INT 16 (mod +3), PB 3
    const dcCtx = { tables: dnd5e.tables, derived: { pb: 3 }, cast: { mod: 3 } };
    expect(evaluate(dnd5e.formulas.spell_save_dc, dcCtx)).toBe(14);

    // GURPS: success check - rolled 10 against DX 12 succeeds, margin 2
    const gurpsCtx = { target: 12, roll: { total: 10 } };
    expect(evaluate(gurps.formulas.success, gurpsCtx)).toBe(true);
    expect(evaluate(gurps.formulas.margin_of_success, gurpsCtx)).toBe(2);

    // GURPS: ST 10 → Basic Lift = 10*10/5 = 20 lbs
    expect(evaluate(gurps.formulas.basic_lift_lbs, { st: 10 })).toBe(20);
  });
});
