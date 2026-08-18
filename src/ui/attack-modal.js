/**
 * Pure attack resolution (dice + damage). Modal UI lives in AttackModal.jsx,
 * which imports `resolveAttack` from here.
 */

import { esc } from '../utils/component.js';

export async function resolveAttack(ui, attackerTokenId, targetTokenId, attackData, resultContainer) {
  const attacker = ui.state.tokens.get(attackerTokenId);
  const target   = ui.state.tokens.get(targetTokenId);
  if (!attacker || !target) {
    ui._toast('Select a target before attacking.', 'warn');
    return;
  }

  const sysConfig = ui.state.settings.systemConfig ?? {};
  const combatRules = sysConfig.combat ?? {};
  const critThreshold  = combatRules.critThreshold  ?? 20;
  const fumbleThreshold = combatRules.fumbleThreshold ?? 1;
  const defenseKey = combatRules.defenseKey ?? 'ac';

  const attackBonus = attackData.attack_bonus ?? 0;
  const bonusStr = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
  const attackFormula = (sysConfig.rolls?.attack ?? '1d20+{bonus}').replace('{bonus}', bonusStr).replace('+-', '-');

  const rollResult = ui.diceRoller.roll(attackFormula);
  const d1    = rollResult.rolls[0];
  const total = rollResult.result;
  const targetDefense = target[defenseKey] ?? 10;
  const defenseLabel  = defenseKey.toUpperCase();

  const isCrit   = d1 >= critThreshold;
  const isFumble = d1 <= fumbleThreshold;
  const isHit    = !isFumble && (isCrit || total >= targetDefense);

  let damageTotal = 0;
  if (isHit && attackData.damage) {
    let dmgFormula = attackData.damage;
    if (isCrit) dmgFormula = dmgFormula.replace(/(\d+)d(\d+)/gi, (_, n, s) => `${parseInt(n, 10) * 2}d${s}`);
    damageTotal = ui.diceRoller.roll(dmgFormula).result;

    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="attack-result attack-result--hit">
          <div class="attack-result__roll">${isCrit ? '💥 Critical Hit!' : '🎯 Hit!'} - Rolled ${String(total)} vs ${esc(defenseLabel)} ${esc(String(targetDefense))}</div>
          <div class="attack-result__damage">Damage: <strong>${String(damageTotal)}</strong> ${esc(attackData.damage_type || '')}</div>
          <div style="margin-top:8px;">
            <button class="btn-primary" id="apply-damage-btn" style="width:100%;" data-damage="${String(damageTotal)}">Apply ${String(damageTotal)} damage to ${esc(target.name)}</button>
          </div>
        </div>`;
    }
  } else if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="attack-result attack-result--miss">
        <div class="attack-result__roll">${isFumble ? '💨 Fumble!' : '❌ Miss'} - Rolled ${String(total)} vs ${esc(defenseLabel)} ${esc(String(targetDefense))}</div>
      </div>`;
  }

  const attackerName = attacker.name;
  const targetName   = target.name;
  const chatMsg = isHit
    ? `⚔️ **${attackerName}** attacks **${targetName}** with ${attackData.name || 'an attack'}: HIT → **${damageTotal}** damage!`
    : `⚔️ **${attackerName}** attacks **${targetName}**: MISS`;
  if (ui.chat) await ui.chat._send(chatMsg);
  ui._log('⚔️', esc(chatMsg.replace(/\*\*/g, '')));
}
