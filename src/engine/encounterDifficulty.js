/**
 * DMG-method encounter difficulty calculator.
 *
 * Pure and ruleset-agnostic: every number comes from `tables`. Systems
 * without an encounter-budget concept simply omit these tables, and this
 * returns null rather than guessing at D&D-shaped numbers.
 */

import { lookupTable } from './lookupTable.js';

const DIFFICULTY_TABLE_KEYS = [
  'cr_to_xp',
  'encounter_threshold_easy',
  'encounter_threshold_medium',
  'encounter_threshold_hard',
  'encounter_threshold_deadly',
  'encounter_multiplier_by_count',
];

function hasRequiredTables(tables) {
  if (!tables || typeof tables !== 'object') return false;
  return DIFFICULTY_TABLE_KEYS.every((key) => tables[key] && typeof tables[key] === 'object');
}

function sumThreshold(table, partyLevels) {
  return partyLevels.reduce((sum, level) => sum + (lookupTable(table, level) ?? 0), 0);
}

function classifyDifficulty(adjustedXp, thresholds) {
  if (adjustedXp < thresholds.easy) return 'trivial';
  if (adjustedXp < thresholds.medium) return 'easy';
  if (adjustedXp < thresholds.hard) return 'medium';
  if (adjustedXp < thresholds.deadly) return 'hard';
  return 'deadly';
}

/**
 * @param {number[]} partyLevels
 * @param {Array<string|number>} monsterCRs
 * @param {Record<string, any>} tables - the active ruleset's `tables` object
 * @returns {{ totalXp: number, adjustedXp: number, thresholds: { easy: number, medium: number, hard: number, deadly: number }, difficulty: string } | null}
 */
export function calculateEncounterDifficulty(partyLevels, monsterCRs, tables) {
  if (!hasRequiredTables(tables)) return null;

  const totalXp = monsterCRs.reduce((sum, cr) => sum + (lookupTable(tables.cr_to_xp, cr) ?? 0), 0);

  const multiplier =
    monsterCRs.length === 0 ? 1 : lookupTable(tables.encounter_multiplier_by_count, monsterCRs.length, { clamp: 'floor' }) ?? 1;

  const adjustedXp = totalXp * multiplier;

  const thresholds = {
    easy: sumThreshold(tables.encounter_threshold_easy, partyLevels),
    medium: sumThreshold(tables.encounter_threshold_medium, partyLevels),
    hard: sumThreshold(tables.encounter_threshold_hard, partyLevels),
    deadly: sumThreshold(tables.encounter_threshold_deadly, partyLevels),
  };

  return {
    totalXp,
    adjustedXp,
    thresholds,
    difficulty: classifyDifficulty(adjustedXp, thresholds),
  };
}
