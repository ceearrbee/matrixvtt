/**
 * loot-actions.js - surfaces the post-roll action prompt and the
 * helpers it dispatches to.
 *
 * The prompt opens on every roll - not just when an entry is linked
 * to a known item. Three plain-text buttons:
 *   - Award to PC…   → pick a PC, append the item id to their inventory
 *   - Drop on map    → enter a one-shot placement mode; next map click
 *                      spawns a token derived from the item
 *   - Just close     → no-op, history is logged to chat already
 *
 * When the entry is *not* linked to an item, Award and Drop synthesise
 * an ad-hoc item from the rolled text so the GM doesn't have to author
 * one by hand. The synth item lives in `ui.state.items` like any other
 * - same writer surface, same lifecycle.
 *
 * Plain text labels - no leading emoji - so the buttons can't be
 * mistaken for the EmojiPicker.
 */

import { h } from 'preact';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { esc } from '../../utils/component.js';
import { EVENT_TYPES } from '../../utils/constants.js';
import { allocateEntityId } from '../../utils/stable-id.js';
import { closeAllModals } from '../../utils/modal-helpers.js';
import { saveChildEntity } from '../child-entity-crud.js';
import { pendingPlacementSignal } from '../../state/signals.js';

/**
 * Open the post-roll action prompt. Returns the modal element so callers
 * / tests can introspect. `itemId` may be null - when no real item is
 * linked, Award/Drop create one on the fly from `entryText`.
 */
export function showLootActionPrompt(ui, { tableName, entryText, itemId }) {
  const item = itemId ? ui.state.items?.get?.(itemId) : null;
  const label = item?.name || entryText || 'rolled result';

  return openModal((close) => {
    const award = async () => {
      close();
      const id = itemId || (await synthItemFromText(ui, entryText));
      if (id) showAwardPCPicker(ui, id);
    };
    const drop = async () => {
      close();
      const id = itemId || (await synthItemFromText(ui, entryText));
      if (id) beginItemDrop(ui, id);
    };
    return h(Modal, { id: 'loot-action-modal', title: `Loot rolled: ${tableName}`, onClose: close }, [
      h('p', { style: 'margin-top:0;' }, ['Rolled: ', h('strong', null, label)]),
      h('p', { class: 'muted-small' }, item
        ? ['Linked item: ', h('strong', null, item.name || itemId)]
        : 'No linked item; Award and Drop will create one from this text.'),
      h('div', { class: 'form-actions', style: 'flex-wrap:wrap;gap:6px;' }, [
        h('button', { class: 'dbt btn-primary', 'data-loot-award': true, onClick: award }, 'Award to PC…'),
        h('button', { class: 'dbt', 'data-loot-drop': true, onClick: drop }, 'Drop on map'),
        h('button', { class: 'dbt', 'data-modal-close': true }, 'Just close'),
      ]),
    ]);
  });
}

/**
 * Create a new item from a plain-text label so Award/Drop have an id
 * to act on. Returns the new item id, or null if the write fails.
 *
 * The synth item carries `synthesized: true` + the source text in
 * `description`, so a curious GM can see where it came from.
 */
export async function synthItemFromText(ui, text) {
  const name = (text || 'rolled item').trim();
  const id = await allocateEntityId('itm', ui.state.items);
  const item = { name, type: 'Loot', description: name, synthesized: true };
  const ok = await saveChildEntity(ui, {
    eventType: EVENT_TYPES.ITEM,
    id,
    entity: item,
    noun: 'item',
    verb: 'create',
  });
  return ok ? id : null;
}

/** Open a list of PCs; clicking one appends `itemId` to their inventory_ids. */
function showAwardPCPicker(ui, itemId) {
  const item = ui.state.items?.get?.(itemId);
  const characters = [...(ui.state.characters?.entries?.() ?? [])];
  if (characters.length === 0) {
    ui._toast?.('No characters to award to', 'warn');
    return null;
  }
  return openModal((close) => {
    const award = async (charId) => {
      const ok = await awardItemToCharacter(ui, charId, itemId);
      if (ok) {
        const charName = ui.state.characters.get(charId)?.name || charId;
        const itemName = item?.name || itemId;
        ui._log?.('🎁', `<b>${esc(itemName)}</b> awarded to <b>${esc(charName)}</b>`);
        ui._toast?.(`Awarded ${itemName} to ${charName}`, 'success');
      }
      close();
    };
    return h(Modal, { id: 'loot-award-picker-modal', title: `Award ${item?.name || itemId} to…`, onClose: close }, [
      h('div', { style: 'max-height:320px;overflow-y:auto;' },
        characters.map(([id, c]) => h('button', {
          class: 'dbt', key: id,
          style: 'display:flex;justify-content:space-between;width:100%;text-align:left;margin-bottom:4px;',
          onClick: () => award(id),
        }, [
          h('span', null, c.name || id),
          h('span', { class: 'muted-small' }, `${c.inventory_ids?.length ?? 0} items`),
        ]))),
      h('div', { class: 'form-actions' },
        h('button', { class: 'dbt', 'data-modal-close': true }, 'Cancel')),
    ]);
  });
}

/** Append `itemId` to the character's `inventory_ids` and persist. */
export async function awardItemToCharacter(ui, charId, itemId) {
  const character = ui.state.characters?.get?.(charId);
  if (!character) return false;
  const inventory_ids = [...(character.inventory_ids ?? []), itemId];
  await ui.state.updateCharacter(charId, { ...character, inventory_ids });
  return true;
}

/**
 * Set the one-shot placement signal. The map-stage click handler reads
 * `pendingPlacementSignal` and, when matched, spawns the token + clears
 * the signal.
 *
 * Closes any open modals first - otherwise the GM is left with a modal
 * (loot-action, GM panel) over the map. The next click would hit the
 * modal backdrop and dismiss the modal instead of reaching the stage,
 * and the placement would silently fail.
 */
export function beginItemDrop(ui, itemId) {
  closeAllModals();
  pendingPlacementSignal.value = { kind: 'item-token', itemId };
  ui._toast?.('Click on the map to drop the item', 'info');
}

/**
 * Spawn a token from an item at the given world coordinates (`col`, `row`).
 * Used by the map click handler when a pending item-token placement is
 * waiting. Token name + image are derived from the item; HP/AC are stub
 * defaults appropriate for an inert prop.
 */
export async function spawnItemToken(ui, itemId, { col, row }) {
  const item = ui.state.items?.get?.(itemId);
  if (!item) return false;
  const map_id = ui.state?.activeMapId;
  if (!map_id) {
    ui._toast?.('No active map. The item can\'t be dropped.', 'error');
    return false;
  }
  // Token schema requires non-negative integer col/row. Guard against
  // NaN / negative inputs (e.g. click outside the panned origin) so
  // the placement doesn't fail validation invisibly.
  const safeCol = Math.max(0, Math.floor(Number(col)) || 0);
  const safeRow = Math.max(0, Math.floor(Number(row)) || 0);
  await ui.createToken({
    name: item.name || 'Item',
    type: 'item',
    // Link back to the originating item so the GM Items view can tell
    // "this token represents that item on the map".
    item_id: itemId,
    color: '#a98b5d',
    map_id,
    col: safeCol,
    row: safeRow,
    hp_current: 0,
    hp_max: 0,
    ac: 0,
    size: 1,
    image_url: item.image_url || null,
  });
  return true;
}
