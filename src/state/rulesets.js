/**
 * Built-in ruleset registry.
 *
 * Loads JSON files from `src/content/rulesets/` and returns them keyed by
 * slug. Every ruleset conforms to `docs/RULESET-SPEC.md`; no legacy
 * preset fields remain in the codebase.
 *
 * Users can also import `.vttruleset.json` files at runtime - those go
 * through `validateRuleset` on upload and land directly in
 * `settings.systemConfig` without touching this registry.
 */

// `with { type: 'json' }` is the standardized import attribute - required by
// Node >= 20 when this module is loaded outside Vite (e.g. the docs:generate
// script). Vite / Vitest accept it transparently.
import dnd5e from '../content/rulesets/dnd5e.json' with { type: 'json' };
import fate from '../content/rulesets/fate.json' with { type: 'json' };
import gurps from '../content/rulesets/gurps.json' with { type: 'json' };
import ose from '../content/rulesets/ose.json' with { type: 'json' };
import pbta from '../content/rulesets/pbta.json' with { type: 'json' };
import wod from '../content/rulesets/wod.json' with { type: 'json' };
import opend6 from '../content/rulesets/opend6.json' with { type: 'json' };
import risus from '../content/rulesets/risus.json' with { type: 'json' };
import savageWorlds from '../content/rulesets/savage-worlds.json' with { type: 'json' };
import { hasCompendium } from '../content/compendium/index.js';

// The ruleset a new campaign gets when nobody picks one. Declared here
// so the picker, the room-creation fallback and initBlankCampaign all
// read the same slug.
export const DEFAULT_RULESET_SLUG = 'dnd5e';

/**
 * One line for the system picker: what content the ruleset actually
 * ships, so a GM learns it before committing rather than after. Read
 * from the ruleset file and the compendium registry, so a newly added
 * ruleset gets a correct line without touching the picker.
 */
export function describeRulesetContent(slug, preset) {
  const parts = [];
  if (hasCompendium(slug)) parts.push('a browsable compendium of spells, monsters and items');
  if (preset?.classes?.length) parts.push('classes');
  if (preset?.skills?.length) parts.push('skills');
  if (preset?.conditions?.length) parts.push('conditions');
  if (parts.length === 0) {
    return 'Dice mechanics and sheet layouts only - this system has no open content licence, so bring your own material.';
  }
  const last = parts.pop();
  const list = parts.length ? `${parts.join(', ')} and ${last}` : last;
  return `Ships ${list}. You add your own content on top.`;
}

export function getGameSystemPresets() {
  return {
    dnd5e,
    fate,
    gurps,
    ose,
    pbta,
    wod,
    opend6,
    risus,
    savage_worlds: savageWorlds,
  };
}
