/**
 * selection.js - character / NPC selection + tab switch. If the
 * entity has a placed token, we select the token on the map and let
 * the map selection drive sheet focus; otherwise we set the direct
 * selection id on the state manager.
 */

import { logger } from '../../utils/logger.js';
import { TABS } from '../../utils/constants.js';

/**
 * `opts.switchTab` (default true) - drop to false to select an entity
 * without yanking the user away from their current tab. Used by the
 * GM Items view's "on <name>" badge: selecting Aria from there
 * shouldn't switch out of the Items list.
 */
export function selectCharacterById(ui, charId, opts = {}) {
  _selectEntity(ui, charId, ui.state.characters, 'selectedCharacterId', TABS.SHEET, opts);
}

export function selectNPCById(ui, npcId, opts = {}) {
  _selectEntity(ui, npcId, ui.state.npcs, 'selectedNPCId', TABS.NPC, opts);
}

function _selectEntity(ui, id, collection, selectionKey, tab, opts = {}) {
  if (!collection.has(id)) return logger.error('UI', `Entity not found: ${id}`);

  let tokenId = null;
  for (const [tid, t] of ui.state.tokens.entries()) {
    if (t.sheet_id === id) { tokenId = tid; break; }
  }

  ui.state[selectionKey] = id;
  if (tokenId && ui.mapRenderer) {
    ui.mapRenderer.setSelectedToken(tokenId);
    ui.state.selectedToken = tokenId;
  }

  if (opts.switchTab !== false) ui.switchTab(tab);
}
