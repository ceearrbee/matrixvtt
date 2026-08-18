/**
 * executeAttack - automated attack resolution: roll to-hit against the
 * active ruleset's defense field, roll damage on a hit, and hand the
 * total to the caller's damage-audit callback (`applyDamage` - wire it to
 * the existing token damage path, e.g. mapRenderer.applyDamage).
 *
 * Ruleset-agnostic: a system with no `harm_model` has no trackable harm
 * to automate, so this is a no-op returning null. Crit/fumble handling
 * only fires when the ruleset declares `combat.critThreshold` /
 * `combat.fumbleThreshold` - no hardcoded natural-20 assumption.
 */

import { rollNotation } from '../engine/roll.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { secretRollSignal } from '../state/ui-signals.js';

function dispatchRoll(rollResult, label) {
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.DICE_ROLL_RESULT, {
    detail: {
      expression: rollResult.notation,
      results: rollResult.rolls,
      modifiers: rollResult.modifier,
      total: rollResult.total,
      label,
      secret: secretRollSignal.value,
    },
  }));
}

function doubleDamageDice(formula) {
  return formula.replace(/(\d+)d(\d+)/gi, (_, count, sides) => `${parseInt(count, 10) * 2}d${sides}`);
}

/**
 * Substitute `{bonus}` into a ruleset roll template. Strips whatever sign
 * character the template places directly before `{bonus}` (its author
 * doesn't know if the runtime bonus will be positive or negative) and
 * appends the modifier with its own correct sign instead.
 */
function applyBonusToTemplate(template, bonus) {
  const withoutBonus = template.replace(/[+-]?\{bonus\}/g, '');
  if (bonus === 0) return withoutBonus;
  return `${withoutBonus}${bonus > 0 ? '+' : ''}${bonus}`;
}

/**
 * @param {object} options
 * @param {object} [options.ruleset] - active systemConfig; needs `harm_model` to do anything
 * @param {object} [options.action] - {name, attack_bonus, damage, damage_type}
 * @param {object} [options.target] - entity/token read for the defense field
 * @param {string} [options.attackerName]
 * @param {string} [options.targetName]
 * @param {() => number} [options.rng]
 * @param {(amount: number, meta: {crit: boolean, damageType: string|null}) => Promise<void>} [options.applyDamage]
 */
export async function executeAttack({
  ruleset,
  action,
  target,
  attackerName = 'Attacker',
  targetName = 'Target',
  rng = Math.random,
  applyDamage,
} = {}) {
  if (!ruleset?.harm_model?.type || !action) return null;

  const combatRules = ruleset.combat ?? {};
  const defenseKey = combatRules.defenseKey ?? 'ac';
  const attackTemplate = ruleset.rolls?.attack ?? '1d20+{bonus}';
  const attackFormula = applyBonusToTemplate(attackTemplate, action.attack_bonus ?? 0);

  const attackRoll = rollNotation(attackFormula, { rng });
  dispatchRoll(attackRoll, `${attackerName} attacks ${targetName}${action.name ? ` with ${action.name}` : ''}`);

  const naturalRoll = attackRoll.rolls[0];
  const isCrit = combatRules.critThreshold != null && naturalRoll >= combatRules.critThreshold;
  const isFumble = !isCrit && combatRules.fumbleThreshold != null && naturalRoll <= combatRules.fumbleThreshold;
  const targetDefense = target?.[defenseKey];
  const isHit = !isFumble && (isCrit || attackRoll.total >= targetDefense);

  const result = { hit: isHit, crit: isCrit, fumble: isFumble, attackRoll, targetDefense, damage: 0, damageRoll: null };
  if (!isHit || !action.damage) return result;

  const damageFormula = isCrit ? doubleDamageDice(action.damage) : action.damage;
  const damageRoll = rollNotation(damageFormula, { rng });
  dispatchRoll(damageRoll, `${targetName} damage`);

  result.damageRoll = damageRoll;
  result.damage = damageRoll.total;

  if (applyDamage) await applyDamage(damageRoll.total, { crit: isCrit, damageType: action.damage_type ?? null });

  return result;
}
