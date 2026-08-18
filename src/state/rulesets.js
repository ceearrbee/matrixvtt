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
