/**
 * `evaluate` coerces an unresolved path with `Number(v) || 0`, so a
 * formula that reaches for a key the context never carries reports a
 * confident 0 instead of failing. `carry_capacity` asked for `@str`,
 * which is `{ score, mod }`, and every character's capacity was 0.
 *
 * Every `@path` in a formula the sheet renders must land on a number on
 * a fully-populated character.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildCharacterFormulaContext } from '../engine/characterFormulaContext.js';
import { ENTITY_TYPES } from '../utils/constants.js';

const RULESETS = join(process.cwd(), 'src/content/rulesets');

function pathsIn(node, out = []) {
  if (typeof node === 'string') {
    if (node.startsWith('@')) out.push(node);
  } else if (Array.isArray(node)) {
    for (const child of node) pathsIn(child, out);
  } else if (node && typeof node === 'object') {
    for (const child of Object.values(node)) pathsIn(child, out);
  }
  return out;
}

function resolvePath(path, context) {
  let cur = context;
  for (const part of path.slice(1).split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Formulas whose only caller passes a context of its own, so the
 * character context below is the wrong yardstick for them.
 *
 *   ability_mod       character-calculations.js, per attribute `{ score }`
 *   concentration_dc  map/actions/combat.js, per hit `{ damage }`
 */
const BESPOKE_CONTEXT = new Set(['ability_mod', 'concentration_dc']);

/** A character carrying every field the sheets and schema know about. */
function populatedCharacter(ruleset) {
  const attributes = {};
  for (const attr of ruleset.attributes ?? []) attributes[attr.key] = 14;
  const first = ruleset.attributes?.[0]?.key;
  return {
    id: 'char-fixture',
    name: 'Fixture',
    type: ENTITY_TYPES.PC,
    level: 5,
    attributes,
    ac: 15,
    armor_bonus: 2,
    spellcasting_ability: first,
    skill_proficiencies: (ruleset.skills ?? []).map((s) => s.key ?? s),
    extra_bonuses: 0,
  };
}

const INVENTORY = [
  { id: 'it-1', name: 'Chain Shirt', weight: 20, quantity: 1, cost_gp: 50, ac_bonus: 3, equipped: true },
];

describe('character formulas resolve every path they reach for', () => {
  for (const file of readdirSync(RULESETS).filter((f) => f.endsWith('.json'))) {
    const ruleset = JSON.parse(readFileSync(join(RULESETS, file), 'utf8'));
    const character = populatedCharacter(ruleset);
    const context = buildCharacterFormulaContext(ruleset, character, { inventory: INVENTORY });

    for (const [name, formula] of Object.entries(ruleset.formulas ?? {})) {
      if (BESPOKE_CONTEXT.has(name)) continue;

      for (const path of pathsIn(formula)) {
        it(`${file}: ${name} resolves ${path}`, () => {
          const value = resolvePath(path, context);
          expect(
            typeof value === 'number' || typeof value === 'boolean',
            `${path} resolves to ${JSON.stringify(value)}; evaluate() will read it as 0`,
          ).toBe(true);
        });
      }
    }
  }
});
