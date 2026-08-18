/**
 * ownership.js - character claim / unclaim and the token ownership
 * sync that keeps placed tokens' `owner_user_id` pointed at whoever
 * currently holds the sheet.
 */

import { h } from 'preact';
import { confirm } from '../confirm-dialogs.jsx';
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { ENTITY_TYPES } from '../../utils/constants.js';

export async function claimCharacter(ui, charId) {
  const character = ui.state.characters.get(charId);
  if (!character || character.claimed_by_user_id) return;

  confirm(h('span', null, ['Claim ', h('strong', null, character.name), ' as your character?']), async () => {
    const updated = { ...character, claimed_by_user_id: ui.widgetManager.userId };
    ui.state.selectedCharacterId = charId;

    try {
      await ui.state.updateCharacter(charId, updated);
      await _syncTokenOwnership(ui, charId, ui.widgetManager.userId);
      ui._syncDisplayName();
    } catch (e) { showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to claim character', e)); }
  });
}

export async function unclaimCharacter(ui, charId) {
  const character = ui.state.characters.get(charId);
  if (!character || (!ui.state.isGM() && character.claimed_by_user_id !== ui.widgetManager.userId)) return;

  const updated = { ...character, claimed_by_user_id: null };

  try {
    await ui.state.updateCharacter(charId, updated);
    await _syncTokenOwnership(ui, charId, null);
  } catch (e) { showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to release character', e)); }
}

/**
 * GM assigns control of an NPC to a player (or clears it with a null
 * userId). The controlling player then sees the creature in their Party
 * roster - the model for summons, familiars, and henchmen. GM-only.
 */
export async function assignNPCController(ui, npcId, userId) {
  if (!ui.state.isGM()) return;
  const npc = ui.state.npcs.get(npcId);
  if (!npc) return;
  try {
    await ui.state.updateNPC(npcId, { ...npc, controlled_by: userId || null });
  } catch (e) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to assign NPC control', e));
  }
}

export async function releaseNPCController(ui, npcId) {
  return assignNPCController(ui, npcId, null);
}

async function _syncTokenOwnership(ui, charId, userId) {
  let failed = 0;
  for (const [tid, t] of ui.state.tokens) {
    if (t.sheet_id === charId && t.type === ENTITY_TYPES.PC) {
      try {
        await ui.state.updateToken(tid, { ...t, owner_user_id: userId });
      } catch { failed++; }
    }
  }
  if (failed > 0) ui._toast(`Sync failed for ${failed} tokens`, 'warn');
}
