/**
 * entity-writers.js - tokens + per-collection CRUD facade writers
 * (characters, NPCs, items, spells, handouts, tables). Tokens get
 * position validation and wall-collision checks; the other entities
 * share a common upsert/remove factory.
 */

import { EVENT_TYPES } from '../../utils/constants.js';
import { canMoveToken } from '../reader.js';
import { segmentsIntersect } from '../../utils/geometry.js';
import { revealFogAroundToken } from './world-writers.js';

export async function updateToken(sm, tokenId, token) {
  if (Object.keys(token).length === 0) {
    sm.yjs.tokensMap.delete(tokenId);
    return;
  }
  const map = sm.map;
  if (map && typeof token.col === 'number' && typeof token.row === 'number') {
    const size = token.size || 1;
    const maxCol = Math.max(0, (map.width_cells || 0) - size);
    const maxRow = Math.max(0, (map.height_cells || 0) - size);
    token = {
      ...token,
      col: Math.max(0, Math.min(token.col, maxCol)),
      row: Math.max(0, Math.min(token.row, maxRow)),
    };
  }
  sm.yjs.tokensMap.set(tokenId, token);
}

export async function deleteToken(sm, tokenId) {
  return updateToken(sm, tokenId, {});
}

export async function updateTokenPosition(sm, tokenId, col, row) {
  const token = sm.tokens.get(tokenId);
  if (!token || !canMoveToken(sm, tokenId)) throw new Error('Denied');
  
  const map = sm.map;
  const size = token.size || 1;
  const maxCol = map ? Math.max(0, map.width_cells - size) : col;
  const maxRow = map ? Math.max(0, map.height_cells - size) : row;
  const newCol = Math.max(0, Math.min(col, maxCol));
  const newRow = Math.max(0, Math.min(row, maxRow));

  if (map && _crossesSolidWall(sm, token, newCol, newRow, map.cell_px || 40)) {
    throw new Error('Blocked by wall');
  }
  // New object, never an in-place mutation of the mirror entry: the
  // mirror belongs to the Yjs bridge, and mutating it directly leaves
  // local state changed even when the write throws.
  const next = { ...token, col: newCol, row: newRow };
  sm.yjs.tokensMap.set(tokenId, next);

  const bright = typeof next.vision_radius === 'number' ? next.vision_radius : 0;
  const dark = typeof next.darkvision_radius === 'number' ? next.darkvision_radius : 0;
  const sightRadius = Math.max(bright, dark);
  if (sightRadius > 0) {
    revealFogAroundToken(sm, tokenId, sightRadius).catch((err) => {
      console.warn('[writer] revealFogAroundToken failed:', err?.message || err);
    });
  }
}

function _crossesSolidWall(sm, token, newCol, newRow, cellPx) {
  if (!sm.walls || sm.walls.size === 0) return false;
  if (token.col === newCol && token.row === newRow) return false;
  const size = token.size || 1;
  const from = { x: (token.col + size / 2) * cellPx, y: (token.row + size / 2) * cellPx };
  const to = { x: (newCol + size / 2) * cellPx, y: (newRow + size / 2) * cellPx };
  for (const wall of sm.walls.values()) {
    if (wall?.blocks_movement === false) continue;
    if (!wall?.p1 || !wall?.p2) continue;
    if (segmentsIntersect(from, to, wall.p1, wall.p2)) return true;
  }
  return false;
}

// Every VTT entity type writes through its Y.Map. The Y.Map's observer
// mirrors into sm[coll] via _wireYjsBridges, so consumers reading
// sm.tokens / sm.characters / etc. see the change after the next tick.
function _collectionUpsert(_coll, _type, yjsField) {
  return async function (sm, id, value) {
    sm.yjs[yjsField].set(id, value);
  };
}

function _collectionRemove(_coll, _type, yjsField) {
  return async function (sm, id) {
    sm.yjs[yjsField].delete(id);
  };
}

// Sheets (characters + NPCs) propagate their image_url to every token
// bound by sheet_id. The Konva renderer reads token.image_url directly
// (see src/map/layers/tokens.js), so without this, picking a new icon
// on the sheet form leaves on-canvas tokens stuck on the old portrait.
// One Y.Doc transaction = one bridge fire = one render frame for both
// the sheet AND all bound tokens.
function _sheetUpsert(yjsField) {
  return async function (sm, id, value) {
    sm.yjs.doc.transact(() => {
      sm.yjs[yjsField].set(id, value);
      const nextUrl = value?.image_url ?? null;
      for (const [tokenId, token] of sm.tokens.entries()) {
        if (token?.sheet_id !== id) continue;
        if ((token.image_url ?? null) === nextUrl) continue;
        sm.yjs.tokensMap.set(tokenId, { ...token, image_url: nextUrl });
      }
    });
  };
}

export const updateCharacter = _sheetUpsert('charactersMap');
export const deleteCharacter = _collectionRemove('characters', EVENT_TYPES.CHARACTER, 'charactersMap');
export const updateNPC       = _sheetUpsert('npcsMap');
export const deleteNPC       = _collectionRemove('npcs',       EVENT_TYPES.NPC,       'npcsMap');
export const updateItem      = _collectionUpsert('items',      EVENT_TYPES.ITEM,      'itemsMap');
export const deleteItem      = _collectionRemove('items',      EVENT_TYPES.ITEM,      'itemsMap');
export const updateSpell     = _collectionUpsert('spells',     EVENT_TYPES.SPELL,     'spellsMap');
export const deleteSpell     = _collectionRemove('spells',     EVENT_TYPES.SPELL,     'spellsMap');
export const updateHandout   = _collectionUpsert('handouts',   EVENT_TYPES.HANDOUT,   'handoutsMap');
export const deleteHandout   = _collectionRemove('handouts',   EVENT_TYPES.HANDOUT,   'handoutsMap');
export const updateTable     = _collectionUpsert('tables',     EVENT_TYPES.TABLE,     'tablesMap');
export const deleteTable     = _collectionRemove('tables',     EVENT_TYPES.TABLE,     'tablesMap');
export const updatePage      = _collectionUpsert('pages',      EVENT_TYPES.PAGE,      'pagesMap');
export const deletePage      = _collectionRemove('pages',      EVENT_TYPES.PAGE,      'pagesMap');

export async function setPageThreadRoot(sm, id, eventId) {
  const current = sm.yjs.pagesMap.get(id);
  if (!current) throw new Error(`setPageThreadRoot: unknown page ${id}`);
  const existing = current.thread_root_event_id ?? null;
  if (existing && existing !== eventId) {
    throw new Error(`setPageThreadRoot: page ${id} already has thread root ${existing}`);
  }
  if (existing === eventId) return;
  sm.yjs.pagesMap.set(id, { ...current, thread_root_event_id: eventId });
}
