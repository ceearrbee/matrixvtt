/**
 * characterFormulaContext.js - build the evaluation context a ruleset's
 * character-sheet formulas expect.
 *
 * Ruleset formulas like `passive_perception` reference `@wis.mod`,
 * `@derived.pb`, `@proficient.perception`, etc. Those aren't free -
 * callers (e.g. the stat_grid renderer) have to pre-compute them before
 * calling `computeDerived`. This helper owns that chore so every surface
 * that shows a derived value reads the same numbers.
 *
 * Non-5e systems that declare different attributes or no skill
 * proficiencies still get a valid (mostly empty) context; computeDerived
 * returns null when the referenced formula doesn't exist so the caller
 * renders "-" without crashing.
 */

import { computeDerived } from './computeDerived.js';

/**
 * @param {object} systemConfig - the active ruleset (ui.state.settings.systemConfig)
 * @param {object} character - the PC or NPC record
 * @param {object} [extras] - additional ctx fields (e.g. { inventory })
 * @returns {object} a context object ready to pass to computeDerived
 */
export function buildCharacterFormulaContext(systemConfig, character, extras = {}) {
  const attrs = character?.attributes ?? {};
  const level = character?.level ?? 1;

  // Per-attribute mod lookup: { str: { mod: N }, dex: { mod: N }, … }.
  // `ability_mod` is the expected formula name in the 5e / OSE fixtures;
  // if the ruleset doesn't declare one we skip silently - rulesets
  // without a "mod" concept (Savage Worlds, FATE) pass through.
  const byAttr = {};
  for (const [key, score] of Object.entries(attrs)) {
    const mod = computeDerived(systemConfig, 'ability_mod', { score });
    byAttr[key] = { score, mod: mod ?? 0 };
  }

  const pb = computeDerived(systemConfig, 'proficiency_bonus', { level, ...byAttr }) ?? 0;
  const derived = { pb };

  const castKey = character?.spellcasting_ability;
  const cast = castKey && byAttr[castKey] ? { mod: byAttr[castKey].mod } : { mod: 0 };

  const proficient = {};
  for (const skill of character?.skill_proficiencies ?? []) {
    proficient[skill] = true;
  }

  return {
    character,
    level,
    ...byAttr,
    derived,
    cast,
    proficient,
    extra_bonuses: character?.extra_bonuses ?? 0,
    ...extras,
  };
}
