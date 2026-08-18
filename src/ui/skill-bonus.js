/**
 * skill-bonus.js - pure helper for skill-bonus arithmetic.
 *
 * Extracted from Skills.jsx so the `skill_list` sheet section can
 * compute the same number without re-implementing the prof + expertise
 * fallthrough. Both the tab (Skills.jsx) and the section
 * (characterSheetSections.js → SkillList) consume this.
 */

import { computeDerived } from '../engine/computeDerived.js';

/**
 * @param {object} ui - needs `_calcModifier(score)` to mirror the
 *   ruleset's "mod from score" formula. ui already exposes this.
 * @param {object} character
 * @param {{ key: string, attribute: string }} skillDef
 * @param {number} profBonus - proficiency bonus (precomputed)
 */
export function calcSkillBonus(ui, character, skillDef, profBonus) {
  const overrides = character.skills ?? {};
  if (overrides[skillDef.key] !== undefined) return Number(overrides[skillDef.key]) || 0;
  const attrScore = character.attributes?.[skillDef.attribute] ?? 10;
  const attrMod = ui._calcModifier(attrScore) ?? 0;
  const isProf = (character.skill_proficiencies ?? []).includes(skillDef.key);
  const isExpert = (character.skill_expertise ?? []).includes(skillDef.key);
  if (isExpert) return attrMod + profBonus * 2;
  if (isProf) return attrMod + profBonus;
  return attrMod;
}

/**
 * Resolve the proficiency bonus for `character` against the active
 * ruleset. Returns 0 when the ruleset doesn't declare a
 * `proficiency_bonus` derived formula.
 */
export function proficiencyBonusFor(ruleset, character) {
  return computeDerived(ruleset, 'proficiency_bonus', { level: character?.level ?? 1 }) ?? 0;
}
