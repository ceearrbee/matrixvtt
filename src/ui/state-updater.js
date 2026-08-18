/**
 * state-updater.js - event-handler adapters for dice / damage / heal
 * CustomEvents the canvas and combat pipeline dispatch. State-driven
 * side effects (settings / initiative / character) live in
 * `./state-effects.js` instead.
 */

import { esc } from '../utils/domHelpers.js';
import { describeNetworkError } from '../utils/errorHandling.js';

export async function handleDiceRollResult(ui, event) {
  const rollData = event.detail;
  ui.updateDiceResult(rollData);

  const labelPart = rollData.label ? ` <span style="color:var(--color-text-tertiary)">${esc(rollData.label)}</span>` : '';
  const secretTag = rollData.secret ? ' <span style="color:var(--color-text-tertiary)">[secret]</span>' : '';
  ui._log('🎲', `${rollData.expression} → <b>${rollData.total}</b>${labelPart}${secretTag}`);

  if (ui.chat && !rollData.secret) {
    try {
      await ui.chat.postDiceRollToChat(rollData);
    } catch (e) {
      ui._toast(`Couldn't post the roll to chat. ${describeNetworkError(e)}`, 'error');
    }
  }
}

export async function handleDamage(ui, event) {
  const { tokenId, tokenName, damage, newHp, maxHp, source } = event.detail;
  ui.state.recordDamage?.({
    actor: ui.widgetManager?.userId ?? null,
    target_id: tokenId,
    target_name: tokenName,
    delta: -damage,
    kind: 'damage',
    source: source ?? null,
  });
  ui._log('💔', `${esc(tokenName)} takes <b>${damage}</b> damage → ${newHp}/${maxHp} HP`);
  if (ui.chat) {
    try {
      await ui.chat.announceDamage(tokenName, damage, newHp, maxHp);
    } catch (e) {
      ui._toast(`Couldn't announce damage in chat. ${describeNetworkError(e)}`, 'error');
    }
  }
}

export async function handleHeal(ui, event) {
  const { tokenId, tokenName, heal, newHp, maxHp, source } = event.detail;
  ui.state.recordDamage?.({
    actor: ui.widgetManager?.userId ?? null,
    target_id: tokenId,
    target_name: tokenName,
    delta: heal,
    kind: 'heal',
    source: source ?? null,
  });
  ui._log('💚', `${esc(tokenName)} heals <b>${heal}</b> → ${newHp}/${maxHp} HP`);
  if (ui.chat) {
    try {
      await ui.chat.announceHeal(tokenName, heal, newHp, maxHp);
    } catch (e) {
      ui._toast(`Couldn't announce heal in chat. ${describeNetworkError(e)}`, 'error');
    }
  }
}

export function updateDiceResult(ui, rollData) {
  const { expression, results, modifiers, total, label } = rollData;
  // Advantage / disadvantage rolls produce two dice with one kept and one
  // dropped. Detection: the expression carries the `kh1`/`kl1` modifier,
  // or the label says "Advantage" / "Disadvantage". The kept die is the
  // max for advantage, the min for disadvantage. Standard rolls fall
  // through to the plain join.
  const isAdv = /kh1\b/i.test(expression || '') || label === 'Advantage';
  const isDis = /kl1\b/i.test(expression || '') || label === 'Disadvantage';
  let diceHtml;
  if ((isAdv || isDis) && Array.isArray(results) && results.length === 2) {
    const [a, b] = results;
    const keptValue = isAdv ? Math.max(a, b) : Math.min(a, b);
    // If the two dice are equal, mark the first as kept; visually the
    // pair reads identically and consumers (tests, screen readers) only
    // need a stable rendering, not a coin flip.
    let keptIndex = -1;
    for (let i = 0; i < 2; i++) {
      if (results[i] === keptValue && keptIndex === -1) { keptIndex = i; }
    }
    const spans = results.map((v, i) => {
      const cls = i === keptIndex ? 'dice-result__kept' : 'dice-result__dropped';
      return `<span class="${cls}">${esc(String(v))}</span>`;
    });
    diceHtml = `[ ${spans.join(' ')} ]`;
  } else {
    diceHtml = esc(results.join(' + '));
  }
  ui._latestDiceResult = `
    ${esc(expression)} → <span style="font-weight: 500;">${diceHtml}${modifiers !== 0 ? ' + ' + modifiers : ''} = </span><span class="dice-result__total">${esc(String(total))}</span>
    ${label ? `<span class="dice-result__label">${esc(label)}</span>` : ''}
  `;
}
