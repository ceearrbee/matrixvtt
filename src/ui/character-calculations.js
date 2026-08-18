/**
 * character-calculations.js - Modifier, saving throw, and skill computations.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { computeDerived } from '../engine/computeDerived.js';

/**
 * Compute the modifier for a raw attribute score using the active ruleset's
 * `ability_mod` formula. Returns null when the ruleset has no such formula
 * (some systems, like Savage Worlds, have no derived modifier concept).
 *
 * @param {object} systemConfig
 * @param {number} score
 * @returns {number|null}
 */
export function calcModifier(systemConfig, score) {
  return computeDerived(systemConfig, 'ability_mod', { score });
}

export function deriveCharacterSaves(systemConfig, character) {
  // 1. Explicit per-character saves override everything
  if (character.saving_throws && Object.keys(character.saving_throws).length > 0) {
    return character.saving_throws;
  }

  // 2. Derive from ruleset.saves[] (empty array ⇒ system has no saves),
  //    or fall back to one save per attribute when the field is absent.
  const sources = systemConfig?.saves
    ?? Object.entries(character.attributes ?? {}).map(([k]) => ({ label: k, attribute: k }));

  if (sources.length === 0) return null;

  const saves = sources.reduce((acc, s) => {
    const score = character.attributes?.[s.attribute] ?? 10;
    const mod = calcModifier(systemConfig, score);
    if (mod !== null) acc[s.label] = mod;
    return acc;
  }, {});

  return Object.keys(saves).length > 0 ? saves : null;
}

// renderCharacterSkills was the imperative HTML renderer for the
// Skills section of the character sheet. Replaced by the Preact
// `skills-tab.js` component.
