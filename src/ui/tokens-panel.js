/**
 * tokens-panel.js - Token CRUD operations. The token create/edit modal
 * itself lives in `./TokenFormModal.jsx`; this file only handles the
 * post-submit write paths.
 */

import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';
import { EVENT_TYPES, DISPOSITIONS, ENTITY_TYPES } from '../utils/constants.js';
import { saveChildEntity } from './child-entity-crud.js';
import { TOKEN_COLORS } from '../utils/ui-constants.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { showTokenFormModal } from './TokenFormModal.jsx';

export { showTokenFormModal as showTokenForm };

/**
 * Create a new token
 */
export async function createToken(ui, data) {
  // Refuse upfront when neither the caller nor the current state can
  // supply a map_id. Without this guard the token shipped with
  // `map_id: null`, the schema rejected it, and the user saw a generic
  // STATE_WRITE toast (or worse, nothing at all).
  if (!data.map_id && !ui.state?.activeMapId) {
    ui._toast?.('No active map - can\'t create the token.', 'error');
    return null;
  }
  const tokenId = await allocateEntityId('tok', ui.state.tokens);

  const token = {
    id: tokenId,
    name: data.name,
    type: data.type,
    color: data.color,
    disposition: data.disposition || DISPOSITIONS.NEUTRAL,
    // Without `map_id` the token is never picked up by `tokensForActiveMap`
    // and silently fails to render. Callers may pass `map_id`; otherwise
    // default to the currently active map so a token from any flow
    // (token form, item drop, NPC template) lands somewhere visible.
    map_id: data.map_id || ui.state?.activeMapId || null,
    col: data.col,
    row: data.row,
    hp_current: data.hp_current,
    hp_max: data.hp_max,
    ac: data.ac,
    size: data.size,
    conditions: [],
    sheet_id: null,
    owner_user_id: data.type === ENTITY_TYPES.PC ? ui.widgetManager.userId : null,
    image_url: data.image_url || null,
    aura_radius: data.aura_radius || 0,
    aura_color: data.aura_color || TOKEN_COLORS.AURA_DEFAULT,
    // Optional back-link to a record in `ui.state.items` for tokens
    // that represent a dropped/staged item on the map. Used by the GM
    // Items view to mark such tokens as "on map".
    ...(data.item_id ? { item_id: data.item_id } : {}),
  };

  const ok = await saveChildEntity(ui, {
    eventType: EVENT_TYPES.TOKEN,
    id: tokenId, entity: token, noun: 'token', verb: 'create',
  });
  if (ok) ui.updateMapPanel();
}

/**
 * Update an existing token
 */
export async function updateToken(ui, tokenId, data) {
  const existing = ui.state.tokens.get(tokenId);
  if (!existing) {
    showErrorNotification(new VTTError(ErrorType.STATE_WRITE, `Token not found: ${tokenId}`));
    return;
  }

  const token = {
    ...existing, // Preserve existing fields like sheet_id, owner_user_id, conditions
    id: tokenId, // Ensure id is always present
    name: data.name,
    type: data.type,
    color: data.color,
    disposition: data.disposition || existing.disposition || DISPOSITIONS.NEUTRAL,
    col: data.col,
    row: data.row,
    hp_current: data.hp_current,
    hp_max: data.hp_max,
    ac: data.ac,
    size: data.size,
    image_url: data.image_url !== undefined ? data.image_url : existing.image_url,
    aura_radius: data.aura_radius !== undefined ? data.aura_radius : (existing.aura_radius || 0),
    aura_color: data.aura_color || existing.aura_color || TOKEN_COLORS.AURA_DEFAULT
  };

  const ok = await saveChildEntity(ui, {
    eventType: EVENT_TYPES.TOKEN,
    id: tokenId, entity: token, noun: 'token', verb: 'update',
  });
  if (ok) ui.updateMapPanel();
}

/**
 * Duplicate an existing token
 */
export async function duplicateToken(ui, tokenId) {
  if (!ui.state.isGM()) return;
  const token = ui.state.tokens.get(tokenId);
  if (!token) return;
  const newId = `token-${Date.now()}`;
  const m = token.name.match(/^(.+?)\s*(\d+)$/);
  const newName = m ? `${m[1]} ${parseInt(m[2]) + 1}` : `${token.name} 2`;
  const newToken = { ...token, id: newId, name: newName, col: token.col + 1, row: token.row };
  await ui.state.updateToken(newId, newToken);
}
