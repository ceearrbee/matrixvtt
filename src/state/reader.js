
import { ENTITY_TYPES } from '../utils/constants.js';
import { FOG_MODES } from '../utils/ui-constants.js';

// GM authority is the Matrix power level, never settings.gm_user_ids - the
// roster lives in the shared Yjs doc, which any room member can rewrite.
export function isGM(sm) {
  return getMyPowerLevel(sm) >= 50;
}

/**
 * Resolve the user's effective Matrix power level.
 * Reads sm.powerLevels (populated by the syncer from m.room.power_levels).
 * Returns 0 when no PL state has arrived yet.
 */
export function getMyPowerLevel(sm) {
  const pl = sm.powerLevels;
  if (!pl) return 0;
  const myId = sm.widgetManager?.userId;
  if (myId && pl.users && typeof pl.users[myId] === 'number') return pl.users[myId];
  return typeof pl.users_default === 'number' ? pl.users_default : 0;
}

/**
 * True when the user has enough power to send the given state event type.
 * Falls through `events`, then `events_default`, then `state_default`.
 * If sm.powerLevels has not been populated yet, defaults to allowing the
 * write - the homeserver remains the authoritative gate, and forbidding
 * locally before the PL state arrives would block the GM's own first writes.
 */
export function canSendEventType(sm, type) {
  const pl = sm.powerLevels;
  if (!pl) return true;
  let threshold;
  if (pl.events && typeof pl.events[type] === 'number') threshold = pl.events[type];
  else if (typeof pl.events_default === 'number') threshold = pl.events_default;
  else if (typeof pl.state_default === 'number') threshold = pl.state_default;
  else threshold = 0;
  return getMyPowerLevel(sm) >= threshold;
}

export function canEditEntity(sm, entity) {
  const myId = sm.widgetManager?.userId;
  if (isGM(sm)) return true;
  if (!myId || !entity) return false;
  return entity.player_user_id === myId || entity.claimed_by_user_id === myId;
}

export function canMoveToken(sm, tokenId) {
  const token = sm.tokens.get(tokenId);
  if (!token) return false;
  if (isGM(sm)) return true;
  const myId = sm.widgetManager?.userId;
  if (!myId || !token.owner_user_id || token.owner_user_id !== myId) return false;
  if (sm.initiative?.active) {
    const order = sm.initiative.order || [];
    const idx = sm.initiative.current_index;
    const current = (typeof idx === 'number' && idx >= 0) ? order[idx] : null;
    return current?.token_id === tokenId;
  }
  return true;
}

export function hasTokenForSheet(sm, sheetId) {
  for (const token of sm.tokens.values()) {
    if (token.sheet_id === sheetId) return true;
  }
  return false;
}

export function getCurrentCharacterId(sm) {
  const token = sm.selectedToken ? sm.tokens.get(sm.selectedToken) : null;
  return token?.sheet_id || sm.selectedCharacterId;
}

export function getCurrentCharacter(sm) {
  const id = getCurrentCharacterId(sm);
  return id ? sm.characters.get(id) : null;
}

export function getCurrentNPCId(sm) {
  const token = sm.selectedToken ? sm.tokens.get(sm.selectedToken) : null;
  if (token?.type === ENTITY_TYPES.NPC) return token.sheet_id;
  return sm.selectedNPCId;
}

export function getCurrentNPC(sm) {
  const id = getCurrentNPCId(sm);
  return id ? sm.npcs.get(id) : null;
}

export function getCurrentSpells(sm) {
  const character = getCurrentCharacter(sm);
  return (character?.spell_ids || []).map((id) => sm.spells.get(id)).filter(Boolean);
}

export function getActiveMap(sm) {
  // `settings.active_map_id` can go stale if a map was tombstoned but
  // settings wasn't refreshed (delete-session keeps settings alive by
  // design). Fall back to the first map that IS in the collection so
  // the VTT renders against something instead of treating the room as
  // "no map here" and forcing the first-time-setup wizard.
  if (sm.activeMapId && sm.maps.has(sm.activeMapId)) {
    return sm.maps.get(sm.activeMapId);
  }
  const first = sm.maps?.values?.().next?.();
  return first && !first.done ? first.value : null;
}

export function isTokenVisibleToPlayer(sm, token, revealedSet = null) {
  if (!token || isGM(sm) || token.owner_user_id === sm.widgetManager.userId) return true;
  if (token.visible === false) return false;
  if (sm.fog.mode !== FOG_MODES.HIDDEN) return true;

  const set = revealedSet || new Set(sm.fog.revealed || []);
  const size = token.size || 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (set.has(`${token.col + c},${token.row + r}`)) return true;
    }
  }
  return false;
}

export function getVisiblePages(sm) {
  const me = sm.widgetManager?.userId;
  const gm = isGM(sm);
  const out = [];
  for (const page of sm.pages.values()) {
    if (!page) continue;
    if (page.visibility === 'private') {
      if (page.author === me) out.push(page);
      continue;
    }
    if (page.visibility === 'gm') {
      if (gm) out.push(page);
      continue;
    }
    out.push(page);
  }
  return out;
}

export function canEditPage(sm, page) {
  if (!page) return false;
  const me = sm.widgetManager?.userId;
  if (page.author === me) return true;
  if (isGM(sm) && page.visibility !== 'private') return true;
  return false;
}

