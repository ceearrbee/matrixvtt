/**
 * End-to-end proof that the 5e ruleset JSON + generic engine cover
 * the full 5e rules behaviour with no hardcoded 5e helpers in the
 * engine.
 */

import { describe, it, expect } from 'vitest';
import dnd5e from '../content/rulesets/dnd5e.json';
import { evaluate } from '../engine/evaluate.js';
import { lookupTable } from '../engine/lookupTable.js';
import { applyHarm } from '../engine/applyHarm.js';
import { runStateMachine } from '../engine/runStateMachine.js';

// Helper: evaluation context includes tables for @lookup.
function ctx(extra = {}) {
  return { tables: dnd5e.tables, ...extra };
}

describe('dnd5e ruleset: proficiency_bonus formula', () => {
  const f = dnd5e.formulas.proficiency_bonus;
  it('level 1-4 = 2', () => {
    expect(evaluate(f, ctx({ level: 1 }))).toBe(2);
    expect(evaluate(f, ctx({ level: 4 }))).toBe(2);
  });
  it('level 5 = 3, level 17 = 6, level 20 = 6', () => {
    expect(evaluate(f, ctx({ level: 5 }))).toBe(3);
    expect(evaluate(f, ctx({ level: 17 }))).toBe(6);
    expect(evaluate(f, ctx({ level: 20 }))).toBe(6);
  });
});

describe('dnd5e ruleset: ability_mod formula', () => {
  const f = dnd5e.formulas.ability_mod;
  it('8 → -1, 10 → 0, 16 → +3, 20 → +5', () => {
    expect(evaluate(f, ctx({ score: 8 }))).toBe(-1);
    expect(evaluate(f, ctx({ score: 10 }))).toBe(0);
    expect(evaluate(f, ctx({ score: 16 }))).toBe(3);
    expect(evaluate(f, ctx({ score: 20 }))).toBe(5);
  });
});

describe('dnd5e ruleset: spell_save_dc + spell_attack_bonus', () => {
  it('wizard L1 INT 16 (mod 3): DC 13, attack +5', () => {
    const c = ctx({ derived: { pb: 2 }, cast: { mod: 3 } });
    expect(evaluate(dnd5e.formulas.spell_save_dc, c)).toBe(13);
    expect(evaluate(dnd5e.formulas.spell_attack_bonus, c)).toBe(5);
  });

  it('sorcerer L20 CHA 20 (mod 5): DC 19, attack +11', () => {
    const c = ctx({ derived: { pb: 6 }, cast: { mod: 5 } });
    expect(evaluate(dnd5e.formulas.spell_save_dc, c)).toBe(19);
    expect(evaluate(dnd5e.formulas.spell_attack_bonus, c)).toBe(11);
  });
});

describe('dnd5e ruleset: passive_perception', () => {
  const f = dnd5e.formulas.passive_perception;

  it('non-proficient: 10 + WIS', () => {
    expect(evaluate(f, ctx({ wis: { mod: 2 }, derived: { pb: 2 }, proficient: { perception: false }, extra_bonuses: 0 })))
      .toBe(12);
  });

  it('proficient L5 WIS 14 (mod 2): 10 + 2 + 3 = 15', () => {
    expect(evaluate(f, ctx({ wis: { mod: 2 }, derived: { pb: 3 }, proficient: { perception: true }, extra_bonuses: 0 })))
      .toBe(15);
  });

  it('observant feat is per-character data in extra_bonuses', () => {
    expect(evaluate(f, ctx({ wis: { mod: 2 }, derived: { pb: 2 }, proficient: { perception: false }, extra_bonuses: 5 })))
      .toBe(17);
  });
});

describe('dnd5e ruleset: concentration_dc', () => {
  const f = dnd5e.formulas.concentration_dc;
  it('floors at 10', () => {
    expect(evaluate(f, ctx({ damage: 0 }))).toBe(10);
    expect(evaluate(f, ctx({ damage: 19 }))).toBe(10);
  });
  it('scales to half damage', () => {
    expect(evaluate(f, ctx({ damage: 22 }))).toBe(11);
    expect(evaluate(f, ctx({ damage: 100 }))).toBe(50);
  });
});

describe('dnd5e ruleset: XP / level tables', () => {
  it('xpForLevel via lookup', () => {
    expect(lookupTable(dnd5e.tables.xp_by_level, 1, { clamp: 'nearest' })).toBe(0);
    expect(lookupTable(dnd5e.tables.xp_by_level, 5, { clamp: 'nearest' })).toBe(6500);
    expect(lookupTable(dnd5e.tables.xp_by_level, 20, { clamp: 'nearest' })).toBe(355000);
  });

  it('levelFromXp via reverse lookup (find highest key whose value ≤ xp)', () => {
    // This pattern is the caller-side convention: scan table entries.
    const table = dnd5e.tables.xp_by_level;
    const xp = 6499;
    const entries = Object.entries(table)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => a[0] - b[0]);
    let lvl = 1;
    for (const [k, v] of entries) if (xp >= v) lvl = k;
    expect(lvl).toBe(4);
  });

  it('crToXp via lookup', () => {
    expect(lookupTable(dnd5e.tables.cr_to_xp, '1/4')).toBe(50);
    expect(lookupTable(dnd5e.tables.cr_to_xp, '5')).toBe(1800);
    expect(lookupTable(dnd5e.tables.cr_to_xp, '30')).toBe(155000);
  });
});

describe('dnd5e ruleset: carry_capacity formula', () => {
  it('STR 15 → 225 lbs', () => {
    expect(evaluate(dnd5e.formulas.carry_capacity, ctx({ str: 15 }))).toBe(225);
  });
  it('STR 20 → 300 lbs', () => {
    expect(evaluate(dnd5e.formulas.carry_capacity, ctx({ str: 20 }))).toBe(300);
  });
});

describe('dnd5e ruleset: encounter budget via tables', () => {
  it('sum of thresholds across the party', () => {
    const partyLevels = [3, 3, 3, 3];
    let easy = 0, medium = 0;
    for (const lvl of partyLevels) {
      easy   += lookupTable(dnd5e.tables.encounter_threshold_easy, lvl);
      medium += lookupTable(dnd5e.tables.encounter_threshold_medium, lvl);
    }
    expect(easy).toBe(300);     // 4 × 75
    expect(medium).toBe(600);   // 4 × 150
  });

  it('mixed-level party works from the same tables', () => {
    const levels = [1, 5, 10, 20];
    let deadly = 0;
    for (const l of levels) deadly += lookupTable(dnd5e.tables.encounter_threshold_deadly, l);
    expect(deadly).toBe(100 + 1100 + 2800 + 12700);
  });
});

describe('dnd5e ruleset: harm model (pool)', () => {
  it('subtracts HP from the named track', () => {
    const out = applyHarm(dnd5e.harm_model, { hp: { current: 30, max: 30 } }, 10);
    expect(out.hp.current).toBe(20);
  });

  it('clamps at 0', () => {
    const out = applyHarm(dnd5e.harm_model, { hp: { current: 5 } }, 20);
    expect(out.hp.current).toBe(0);
    expect(out.hp.overflow).toBe(15);
  });
});

describe('dnd5e ruleset: death save state machine', () => {
  const spec = dnd5e.state_machines.death_save;
  const fresh = () => ({ successes: 0, failures: 0, status: 'rolling' });

  it('roll 15 = one success', () => {
    expect(runStateMachine(spec, fresh(), { roll: 15 }).successes).toBe(1);
  });

  it('nat 1 = two failures', () => {
    expect(runStateMachine(spec, fresh(), { roll: 1 }).failures).toBe(2);
  });

  it('nat 20 = revive', () => {
    const out = runStateMachine(spec, { successes: 1, failures: 2, status: 'rolling' }, { roll: 20 });
    expect(out.status).toBe('revive');
  });

  it('three successes → stable', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = runStateMachine(spec, s, { roll: 15 });
    expect(s.status).toBe('stable');
  });

  it('three failures → dead', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = runStateMachine(spec, s, { roll: 5 });
    expect(s.status).toBe('dead');
  });
});
