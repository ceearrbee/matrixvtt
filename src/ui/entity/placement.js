/**
 * placement.js - drop an existing character/NPC sheet onto the map
 * as a token, and create a GM NPC from a built-in template.
 */

import { VTTError, ErrorType, showErrorNotification } from '../../utils/errorHandling.js';
import { EVENT_TYPES, ENTITY_TYPES } from '../../utils/constants.js';
import { TOKEN_COLORS } from '../../utils/ui-constants.js';
import { allocateEntityId } from '../../utils/stable-id.js';
import { esc } from '../../utils/component.js';
import { saveEntity } from './_save.js';

export async function placeSheetOnMap(ui, sheetId, sheetType) {
  const isNPC = sheetType === ENTITY_TYPES.NPC;
  const sheet = isNPC ? ui.state.npcs.get(sheetId) : ui.state.characters.get(sheetId);
  if (!sheet) return;

  // Without a map_id the token fails the schema and is filtered out by the
  // renderer (src/map/layers/tokens.js), so the user sees the success toast
  // but no token. Refuse upfront when there's no active map to stamp.
  if (!ui.state?.activeMapId) {
    ui._toast?.('No active map - can\'t place the token.', 'error');
    return;
  }

  const tokenId = await allocateEntityId('tok', ui.state.tokens);
  const map = ui.state.map;
  const col = Math.floor((map?.width_cells || 10) / 2);
  const row = Math.floor((map?.height_cells || 10) / 2);

  const token = {
    id: tokenId, name: sheet.name, type: isNPC ? ENTITY_TYPES.NPC : ENTITY_TYPES.PC,
    map_id: ui.state.activeMapId,
    color: isNPC ? TOKEN_COLORS.NPC_DEFAULT : TOKEN_COLORS.PC_DEFAULT,
    col, row,
    ...(sheet.hp_max != null
      ? { hp_max: sheet.hp_max, hp_current: sheet.hp_current ?? sheet.hp_max }
      : {}),
    ...(sheet.ac != null ? { ac: sheet.ac } : {}),
    size: 1, conditions: [], sheet_id: sheetId, image_url: sheet.image_url || null,
    owner_user_id: !isNPC ? (sheet.claimed_by_user_id ?? ui.widgetManager.userId) : null,
  };

  try {
    await ui.state.updateToken(tokenId, token);
    ui._toast(`${sheet.name} placed on map`, 'success');
  } catch (e) { showErrorNotification(new VTTError(ErrorType.STATE_WRITE, 'Failed to place token', e)); }
}

export async function createNPCFromTemplate(ui, tmpl) {
  const npcId = await allocateEntityId('npc', ui.state.npcs);
  const npc = {
    id: npcId, type: ENTITY_TYPES.NPC, name: tmpl.name, cr: String(tmpl.cr),
    size_category: tmpl.size_category || 'Medium', hp_max: tmpl.hp_max,
    hp_current: tmpl.hp_max, ac: tmpl.ac, speed: tmpl.speed,
    attributes: { ...tmpl.attributes }, actions: tmpl.actions.map(a => ({ ...a })),
    is_hidden: false, notes: '',
  };

  await saveEntity(ui, EVENT_TYPES.NPC, npcId, npc);
  ui._log('👹', `Created NPC: <b>${esc(npc.name)}</b> (CR ${esc(npc.cr)})`);
  // Surface a toast so the user sees feedback even when the chat log
  // isn't visible. Previously also auto-switched to the NPCs tab -
  // dropped because side-effect-in-helper tab switches are the same
  // pattern we removed from `ui._log`. The toast suffices.
  ui._toast?.(`Created NPC: ${npc.name}`, 'success');
}
