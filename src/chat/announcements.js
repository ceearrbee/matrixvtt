/**
 * announcements.js - outbound chat messages: damage/heal/combat/map
 * announcements, dice-roll results, and arbitrary GM messages.
 *
 * Every helper defers the actual Matrix send to `chat._send(body)`
 * so tests can spy on one method, and so the try/catch around
 * `sendRoomEvent` lives in one place (on the integrator class).
 */

function _shouldAnnounce(chat) {
  return chat.state.settings?.performance?.enable_chat_announcements !== false;
}

function _mirrorToLiveRegion(message, assertive = false) {
  const id = assertive ? 'vtt-sr-critical' : 'vtt-sr-announcements';
  const region = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (region) region.textContent = message;
}

export async function postDiceRollToChat(chat, rollData) {
  const { expression, results, modifiers, total, label } = rollData;

  const character = chat.state.getCurrentCharacter?.();
  const speaker = character
    ? character.name
    : (chat.clientManager.userId?.split(':')[0]?.substring(1) || 'Unknown');

  const rollsStr = results.join(', ');
  const modifierStr = modifiers >= 0 ? `+${modifiers}` : `${modifiers}`;
  const resultStr = modifiers !== 0
    ? `**${total}** (${rollsStr} ${modifierStr})`
    : `**${total}** (${rollsStr})`;

  const labelPart = label ? ` [${label}]` : '';
  await chat._send( `🎲 ${speaker} rolled ${expression}${labelPart}: ${resultStr}`);
}

export async function announceDamage(chat, tokenName, damage, newHp, maxHp) {
  if (!_shouldAnnounce(chat) || !chat.announcements.damage) return;
  await chat._send( `💔 **${tokenName}** takes ${damage} damage! (HP: ${newHp}/${maxHp})`);
}

export async function announceHeal(chat, tokenName, heal, newHp, maxHp) {
  if (!_shouldAnnounce(chat) || !chat.announcements.damage) return;
  await chat._send( `💚 **${tokenName}** heals ${heal} HP! (HP: ${newHp}/${maxHp})`);
}

export async function announceCombat(chat, message) {
  if (!_shouldAnnounce(chat) || !chat.announcements.combat) return;
  await chat._send( `⚔️ ${message}`);
}

export async function announceMapChange(chat, mapName) {
  if (!_shouldAnnounce(chat) || !chat.announcements.mapChanges) return;
  await chat._send( `🗺️ GM loaded new map: **${mapName}**`);
}

export async function announceInitiativeOrder(chat, order) {
  if (!_shouldAnnounce(chat) || !chat.announcements.combat) return;
  if (!Array.isArray(order)) return;
  const orderList = order
    .map((entry, i) => `${i + 1}. ${entry.name ?? '?'} (${entry.initiative ?? '?'})`)
    .join('\n');
  await chat._send( `⚔️ **Initiative Order:**\n${orderList}`);
}

export async function announceTurn(chat, round, name) {
  if (!_shouldAnnounce(chat) || !chat.announcements.combat) return;
  await chat._send( `⚔️ **Round ${round}** - ${name}'s turn!`);
  _mirrorToLiveRegion(`Round ${round} - ${name}'s turn`);
}

export async function announceMessage(chat, message, assertive = false) {
  if (!_shouldAnnounce(chat)) return;
  await chat._send( `⚔️ ${message}`);
  _mirrorToLiveRegion(message, assertive);
}
