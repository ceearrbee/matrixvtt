/**
 * opposed-roll.js - Risus-style combat resolution for slot-paired
 * stress systems. The attacker rolls the clicked pool, the defender
 * answers with their highest-rated named pool, both totals go to chat,
 * and the loser's token takes one harm-model tick (a lost die). Ties
 * announce a reroll and apply nothing, matching Risus.
 */

import { rollNotation } from '../../engine/roll.js';
import { pairedSlotField } from '../attribute-pairing.js';
import { applyDamage } from '../../map/actions/combat.js';
import { esc } from '../../utils/component.js';
import { getRollFormula, expandFormula } from '../dice-helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * The selected enemy token, when an opposed roll applies: combat is
 * active, the system is stress-model and slot-paired, and the map
 * selection is a combatant other than the current one.
 */
export function opposedTargetFor(ui) {
  const systemConfig = ui.state.settings?.systemConfig;
  if (systemConfig?.harm_model?.type !== 'stress') return null;
  if (!pairedSlotField(systemConfig)) return null;
  const { active, order = [], current_index } = ui.state.initiative ?? {};
  if (!active) return null;
  const myTokenId = order[current_index]?.token_id;
  const targetId = ui.state.selectedToken;
  if (!targetId || targetId === myTokenId) return null;
  return ui.state.tokens.has(targetId) ? targetId : null;
}

function sheetForToken(ui, token) {
  if (!token?.sheet_id) return null;
  return ui.state.characters.get(token.sheet_id) ?? ui.state.npcs.get(token.sheet_id) ?? null;
}

function bestPairedPool(ui, sheet) {
  const systemConfig = ui.state.settings?.systemConfig;
  const slotField = pairedSlotField(systemConfig);
  const attrs = systemConfig?.attributes ?? [];
  let best = { label: '', dice: 0 };
  for (const def of attrs) {
    const dice = sheet?.attributes?.[def.key] ?? 0;
    if (dice > best.dice) {
      best = { label: sheet?.[slotField]?.[def.key] || def.label, dice };
    }
  }
  return best;
}

async function announce(ui, text) {
  ui._log?.('⚔️', esc(text));
  try {
    await ui.chat?.announceMessage?.(text);
  } catch (err) {
    logger.warn('Combat', `opposed-roll announce failed: ${err?.message || err}`);
  }
}

export async function resolveOpposedRoll(ui, {
  attackerName, attackerLabel, attackerDice, attackerTokenId, targetTokenId, rng = undefined,
}) {
  const targetToken = ui.state.tokens.get(targetTokenId);
  if (!targetToken) return;
  const template = getRollFormula(ui, 'attribute');
  const formulaFor = (dice) => expandFormula(ui, template, { bonus: dice, mod: dice, score: dice });
  const defender = bestPairedPool(ui, sheetForToken(ui, targetToken));
  const opts = rng ? { rng } : undefined;
  const attackFormula = formulaFor(attackerDice);
  const attack = rollNotation(attackFormula, opts);

  if (defender.dice <= 0) {
    await announce(ui,
      `${attackerName}'s ${attackerLabel} (${attackFormula}) ${attack.total} - ` +
      `${targetToken.name} has no rated pools. Automatic hit: ${targetToken.name} loses a die.`);
    await applyDamage({ state: ui.state }, targetTokenId, 1);
    return;
  }

  const defenseFormula = formulaFor(defender.dice);
  const defense = rollNotation(defenseFormula, opts);
  const head = `${attackerName}'s ${attackerLabel} (${attackFormula}) ${attack.total} vs ` +
    `${targetToken.name}'s ${defender.label} (${defenseFormula}) ${defense.total}`;

  if (attack.total === defense.total) {
    await announce(ui, `${head}. Tie - roll again.`);
    return;
  }

  const attackerWins = attack.total > defense.total;
  const loserTokenId = attackerWins ? targetTokenId : attackerTokenId;
  const loserName = attackerWins ? targetToken.name : attackerName;
  await announce(ui, `${head}. ${loserName} loses a die.`);
  await applyDamage({ state: ui.state }, loserTokenId, 1);
}
