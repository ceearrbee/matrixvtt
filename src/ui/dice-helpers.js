/**
 * dice-helpers.js - Dice rolling helpers for checks, saves, and NPC actions.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { esc } from '../utils/domHelpers.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { secretRollSignal } from '../state/ui-signals.js';

export function handleDiceRoll(ui) {
  const activeDice = document.querySelector('[data-dice].dbt--active');
  if (!activeDice) return;

  const diceType = activeDice.getAttribute('data-dice'); // e.g. "d20"
  const sides = parseInt(diceType.slice(1));
  const modifier = parseInt(/** @type {HTMLInputElement | null} */ (document.getElementById('dice-modifier'))?.value || '0');
  fireRoll(ui, sides, modifier, '');
}

export function rollAttributeCheck(ui, label, value) {
  const baseMod = ui._calcModifier(value) ?? 0;
  const { extra, sources } = consumePendingModifiers(ui);
  const mod = baseMod + extra;
  const formula = expandFormula(ui, getRollFormula(ui, 'attribute'), { bonus: mod, mod, score: value });
  fireFormulaRoll(ui, formula, formatRollLabel(`${label} check`, sources));
}

export function rollSkillCheck(ui, skill, bonus) {
  const { extra, sources } = consumePendingModifiers(ui);
  const total = bonus + extra;
  const formula = expandFormula(ui, getRollFormula(ui, 'skill'), { bonus: total, mod: total, score: total });
  fireFormulaRoll(ui, formula, formatRollLabel(skill.replace(/_/g, ' ') + ' check', sources));
}

/**
 * Reads pending_modifiers off the current character, sums their
 * values, clears the array via updateCharacter, and returns {extra,
 * sources}. Returns {0, []} when no character is selected or the
 * stack is empty - so callers don't need to guard.
 */
function consumePendingModifiers(ui) {
  const character = ui?.state?.getCurrentCharacter?.();
  const stack = character && Array.isArray(character.pending_modifiers)
    ? character.pending_modifiers : [];
  if (stack.length === 0) return { extra: 0, sources: [] };
  const extra = stack.reduce((sum, m) => sum + (Number(m?.value) || 0), 0);
  const sources = stack.map((m) => m?.source).filter(Boolean);
  ui?.patchEntity?.(character.id, { pending_modifiers: [] });
  return { extra, sources };
}

function formatRollLabel(base, sources) {
  if (!sources || sources.length === 0) return base;
  return `${base} (${sources.join(', ')})`;
}

export function rollNPCAction(ui, npcId, actionIndex) {
  const npc = ui.state.npcs.get(npcId);
  if (!npc) return;
  const action = npc.actions?.[actionIndex];
  if (!action) return;

  if (action.attack_bonus !== undefined || action.damage) {
    let attackerTokenId = null;
    for (const [tid, t] of ui.state.tokens.entries()) {
      if (t.sheet_id === npcId || t.character_id === npcId) {
        attackerTokenId = tid;
        break;
      }
    }
    if (attackerTokenId) {
      ui._showAttackModal(attackerTokenId, {
        name: action.name,
        attack_bonus: action.attack_bonus,
        damage: action.damage,
        damage_type: action.damage_type
      });
      return;
    }
  }

  ui._log('⚔️', `${esc(npc.name)} uses <b>${esc(action.name)}</b>.`);
  if (ui.chat) {
    ui.chat.announceMessage(`${npc.name} uses ${action.name}: ${action.description || ''}`).catch(() => {});
  }
}

/**
 * Get the roll formula template for a given check type from the active ruleset.
 * @param {'attribute'|'skill'|'save'|'initiative'|'attack'} type
 */
export function getRollFormula(ui, type) {
  const rolls = ui.state.settings.systemConfig?.rolls;
  const defaults = { attribute: '1d20+{mod}', skill: '1d20+{bonus}', save: '1d20+{bonus}', initiative: '1d20+{bonus}', attack: '1d20+{bonus}' };
  return rolls?.[type] ?? defaults[type] ?? '1d20+{bonus}';
}

/**
 * Substitute tokens in a roll formula template and simplify constant arithmetic.
 */
export function expandFormula(ui, template, ctx) {
  const formula = _substituteTokens(template, ctx);
  return _simplifyMath(formula);
}

function _substituteTokens(template, ctx) {
  return template
    .replace(/\{bonus\}/g, String(Math.round(ctx.bonus ?? 0)))
    .replace(/\{mod\}/g,   String(Math.round(ctx.mod   ?? 0)))
    .replace(/\{score\}/g, String(Math.round(ctx.score ?? 10)));
}

function _simplifyMath(formula) {
  const diceMatch = formula.match(/^(\d+d\d+)(.*)$/i);
  if (!diceMatch) return formula;

  const dicePart = diceMatch[1];
  const modPart = diceMatch[2];
  if (!modPart) return dicePart;

  const modTotal = (modPart.match(/[+-]\d+/g) || [])
    .reduce((sum, t) => sum + parseInt(t, 10), 0);

  if (modTotal === 0) return dicePart;
  return `${dicePart}${modTotal > 0 ? '+' : ''}${modTotal}`;
}

/**
 * Roll a pre-expanded dice formula and dispatch the result event.
 */
export function fireFormulaRoll(ui, formula, label) {
  let result;
  try {
    result = ui.diceRoller.roll(formula);
  } catch (err) {
    logger.error('DiceHelpers', `Failed to roll formula "${formula}":`, err.message);
    fireRoll(ui, 20, 0, label);
    return;
  }
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.DICE_ROLL_RESULT, {
    detail: {
      expression: `${result.formula}`,
      results: result.rolls,
      modifiers: result.modifier,
      total: result.result,
      label,
      secret: secretRollSignal.value
    }
  }));
}

/**
 * Resolve the ruleset-declared roll template for `key` ('advantage' /
 * 'disadvantage' / etc.), replacing the `{bonus}` placeholder with the
 * numeric modifier. Falls back to the classic d20 expression when the
 * ruleset doesn't declare the template.
 *
 * Substituting into the template rather than hard-coding `2d20kh1` means
 * homebrew or non-d20 rulesets that redefine advantage (e.g.
 * `"advantage": "3d6kh1+{bonus}"`) roll according to their own rules.
 */
function _rollTemplate(ui, key, fallback, modifier) {
  const rolls = ui.state.settings?.systemConfig?.rolls ?? {};
  const template = rolls[key] ?? fallback;
  const signed = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  // {bonus} is substituted as a signed numeric term so negatives render
  // as `-3` instead of `+-3` and zero still reduces cleanly.
  return template.replace(/\{bonus\}/g, signed);
}

/** Roll the ruleset's `advantage` template and dispatch vtt:dice-roll-result */
export function fireAdvantageRoll(ui, modifier, label = '') {
  const expression = _rollTemplate(ui, 'advantage', '2d20kh1+{bonus}', modifier);
  fireFormulaRoll(ui, expression, label || 'Advantage');
}

/** Roll the ruleset's `disadvantage` template and dispatch vtt:dice-roll-result */
export function fireDisadvantageRoll(ui, modifier, label = '') {
  const expression = _rollTemplate(ui, 'disadvantage', '2d20kl1+{bonus}', modifier);
  fireFormulaRoll(ui, expression, label || 'Disadvantage');
}

/** Roll 1dN+modifier and dispatch vtt:dice-roll-result */
export function fireRoll(ui, sides, modifier, label) {
  const roll = Math.floor(Math.random() * sides) + 1;
  const total = roll + modifier;
  const modStr = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.DICE_ROLL_RESULT, {
    detail: {
      expression: `1d${sides}${modStr}`,
      results: [roll],
      modifiers: modifier,
      total,
      label,
      secret: secretRollSignal.value
    }
  }));
}
