/**
 * deletion.js - confirm + remove character/NPC, then sweep any
 * orphaned placed tokens sharing the sheet id. Tokens get removed
 * via an empty-content write (the writer treats `{}` as a tombstone).
 */

import { h } from 'preact';
import { confirm } from '../confirm-dialogs.jsx';
import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { EVENT_TYPES } from '../../utils/constants.js';
import { removeFromInitiative } from '../combat/initiative.js';

export function deleteCharacter(ui, charId) {
  _deleteEntity(ui, charId, ui.state.characters, EVENT_TYPES.CHARACTER, 'Delete Character', 'character');
}

export function deleteNPC(ui, npcId) {
  _deleteEntity(ui, npcId, ui.state.npcs, EVENT_TYPES.NPC, 'Delete NPC', 'NPC');
}

function _deleteEntity(ui, id, collection, type, title, kind) {
  const entity = collection.get(id);
  const name = entity?.name || `this ${kind}`;
  const remove = type === EVENT_TYPES.NPC
    ? (i) => ui.state.removeNPC(i)
    : (i) => ui.state.removeCharacter(i);
  confirm(
    h('span', null, [`Delete ${kind} `, h('strong', null, name), '? Their placed tokens will also be removed.']),
    async () => {
      try {
        const orphanTokenIds = Array.from(ui.state.tokens.values())
          .filter((t) => t.sheet_id === id)
          .map((t) => t.id);
        // Items / spells the character owns are referenced only via
        // their inventory_ids / spell_ids arrays. Once the character
        // is gone, they're unreachable orphans - collect ids before
        // the character row is removed.
        const ownedItemIds = [...(entity?.inventory_ids ?? [])];
        const ownedSpellIds = [...(entity?.spell_ids ?? [])];
        await remove(id);
        await deleteOrphanedTokens(ui, id);
        for (const tokId of orphanTokenIds) {
          await removeFromInitiative(ui, tokId);
        }
        for (const itemId of ownedItemIds) {
          await ui.state.removeItem(itemId);
        }
        for (const spellId of ownedSpellIds) {
          await ui.state.removeSpell(spellId);
        }
      } catch (e) { showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to delete', e)); }
    },
    { title, confirmText: 'Delete', confirmClass: 'dbt--danger' }
  );
}

async function deleteOrphanedTokens(ui, sheetId) {
  for (const [tid, t] of ui.state.tokens.entries()) {
    if (t.sheet_id === sheetId) {
      await ui.state.updateToken(tid, {});
    }
  }
}
