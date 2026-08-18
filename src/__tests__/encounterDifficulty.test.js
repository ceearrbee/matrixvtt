/**
 * DMG-method encounter difficulty calculator.
 *
 * Generic: takes ruleset tables as data, never hardcodes DMG numbers. Systems
 * without an encounter-budget concept (tables missing) get a null result
 * rather than a crash.
 */

import { describe, it, expect } from 'vitest';
import { calculateEncounterDifficulty } from '../engine/encounterDifficulty.js';
import { getGameSystemPresets } from '../state/rulesets.js';

const { tables } = getGameSystemPresets().dnd5e;

describe('calculateEncounterDifficulty - DMG example', () => {
  it('classifies four 3rd-level characters against four goblins as easy', () => {
    const result = calculateEncounterDifficulty([3, 3, 3, 3], ['1/4', '1/4', '1/4', '1/4'], tables);

    expect(result.totalXp).toBe(200);
    expect(result.adjustedXp).toBe(400);
    expect(result.thresholds).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1600 });
    expect(result.difficulty).toBe('easy');
  });

  it('classifies a lightly adjusted encounter as medium', () => {
    const result = calculateEncounterDifficulty([3, 3, 3, 3], ['1/4', '1/4', '1/4', '1/4', '1/4', '1/4'], tables);

    expect(result.totalXp).toBe(300);
    expect(result.adjustedXp).toBe(600);
    expect(result.difficulty).toBe('medium');
  });

  it('classifies a swarm as deadly', () => {
    const result = calculateEncounterDifficulty([5, 5, 5, 5], Array(15).fill('1'), tables);

    expect(result.totalXp).toBe(3000);
    expect(result.adjustedXp).toBe(12000);
    expect(result.difficulty).toBe('deadly');
  });
});

describe('calculateEncounterDifficulty - encounter multiplier boundaries', () => {
  const cases = [
    [1, 1],
    [2, 1.5],
    [3, 2],
    [6, 2],
    [7, 2.5],
    [10, 2.5],
    [11, 3],
    [14, 3],
    [15, 4],
    [20, 4],
  ];

  it.each(cases)('%i monster(s) applies a x%s multiplier', (count, multiplier) => {
    const monsters = Array(count).fill('1');
    const result = calculateEncounterDifficulty([5], monsters, tables);

    expect(result.totalXp).toBe(count * 200);
    expect(result.adjustedXp).toBe(count * 200 * multiplier);
  });
});

describe('calculateEncounterDifficulty - empty monster list', () => {
  it('returns zero XP and the lowest difficulty tier', () => {
    const result = calculateEncounterDifficulty([3, 3, 3, 3], [], tables);

    expect(result.totalXp).toBe(0);
    expect(result.adjustedXp).toBe(0);
    expect(result.thresholds).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1600 });
    expect(result.difficulty).toBe('trivial');
  });
});

describe('calculateEncounterDifficulty - ruleset without encounter tables', () => {
  it('returns null when the ruleset has no DMG-style tables', () => {
    const { tables: fateTables } = getGameSystemPresets().fate;

    expect(calculateEncounterDifficulty([3], ['1/4'], fateTables)).toBeNull();
  });

  it('returns null when tables is undefined', () => {
    expect(calculateEncounterDifficulty([3], ['1/4'], undefined)).toBeNull();
  });
});
