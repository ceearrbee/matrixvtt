/**
 * world-writers.js - facade writers for map/fog/walls/drawings. These
 * all touch map-visible state; they live together so the "commit
 * locally, send one event" pattern is in one readable file.
 */

import { allocateEntityId } from '../../utils/stable-id.js';
import { isGM, getActiveMap } from '../reader.js';
import { segmentBlockedByWalls } from '../../utils/geometry.js';
import { VTTError, ErrorType } from '../../utils/errorHandling.js';
import { validateWall, validateLight, validatePin } from '../../utils/schemas/content.js';
import { updateSettings } from './session-writers.js';

/**
 * Run a Valibot-backed validator on a write payload. The schemas
 * require `map_id` which most writer call sites don't pass - those
 * sites mean "for the active map," so we auto-fill it before
 * validation. Throws VTTError(VALIDATION) on failure so the call
 * site's existing .catch(showErrorNotification) chain surfaces it.
 */
function _validateWritePayload(sm, payload, validate, kind) {
  const withMap = payload?.map_id ? payload : { ...payload, map_id: sm.activeMapId };
  try {
    validate(withMap);
  } catch (e) {
    // VTTError from the schema layer carries the field-specific message.
    throw e instanceof VTTError
      ? e
      : new VTTError(ErrorType.VALIDATION, `Invalid ${kind}: ${e.message}`, e);
  }
  return withMap;
}

function requireGM(sm, action) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, `Only the GM can ${action}.`);
}

export async function updateFog(sm, fog) {
  requireGM(sm, 'change fog of war');
  // Drop any caller-supplied base_version (CRDT obviates the LWW guard).
  const { base_version: _omit, version: _omit2, ...rest } = fog ?? {};
  const id = sm.activeMapId;
  if (!id) return;
  sm.yjs.fogMap.set(id, rest);
}

export async function revealFogAroundToken(sm, tokenId, radiusFeet) {
  const token = sm.tokens.get(tokenId);
  const map = getActiveMap(sm);
  if (!token || !map) return;

  const units = sm.settings?.systemConfig?.movement?.unitsPerCell || 5;
  const radiusCells = Math.ceil(radiusFeet / units);
  const revealed = new Set(sm.fog.revealed || []);
  const centerCol = token.col + (token.size || 1) / 2;
  const centerRow = token.row + (token.size || 1) / 2;
  const cellPx = map.cell_px || 40;
  const originPx = { x: centerCol * cellPx, y: centerRow * cellPx };
  const walls = sm.walls ? [...sm.walls.values()] : [];
  let changed = false;

  for (let r = -radiusCells; r <= radiusCells; r++) {
    for (let c = -radiusCells; c <= radiusCells; c++) {
      const col = Math.floor(centerCol + c);
      const row = Math.floor(centerRow + r);
      if (col < 0 || row < 0 || col >= map.width_cells || row >= map.height_cells) continue;
      if (Math.sqrt(c * c + r * r) > radiusCells) continue;
      if (walls.length > 0) {
        const target = { x: (col + 0.5) * cellPx, y: (row + 0.5) * cellPx };
        if (segmentBlockedByWalls(originPx, target, walls)) continue;
      }
      const key = `${col},${row}`;
      if (!revealed.has(key)) {
        revealed.add(key);
        changed = true;
      }
    }
  }

  if (changed) {
    sm.yjs.fogMap.set(sm.activeMapId, { ...sm.fog, revealed: Array.from(revealed) });
  }
}

export async function switchMap(sm, id) {
  requireGM(sm, 'switch maps');
  if (!sm.maps.has(id)) return;
  // Through updateSettings so the resolved systemConfig never lands
  // in room state.
  return updateSettings(sm, { ...sm.settings, active_map_id: id });
}

export async function createMap(sm, config) {
  requireGM(sm, 'create maps');
  const id = await allocateEntityId('map', sm.maps);
  sm.yjs.mapsMap.set(id, config);
  await switchMap(sm, id);
  return id;
}

export async function updateMap(sm, id, config) {
  requireGM(sm, 'edit maps');
  sm.yjs.mapsMap.set(id, config);
}

export async function deleteMap(sm, id) {
  requireGM(sm, 'delete maps');
  if (!sm.maps.has(id) || sm.maps.size === 1) throw new Error('Cannot delete');
  sm.yjs.mapsMap.delete(id);
  if (sm.activeMapId === id) await switchMap(sm, sm.maps.keys().next().value);
}

export async function duplicateMap(sm, id) {
  requireGM(sm, 'duplicate maps');
  const source = sm.maps.get(id);
  if (!source) throw new Error('Not found');
  return createMap(sm, { ...source, name: `${source.name} (Copy)` });
}

export async function addWall(sm, wall) {
  requireGM(sm, 'add a wall');
  if (!wall?.id) throw new Error('Wall must have id');
  const next = _validateWritePayload(sm, wall, validateWall, 'wall');
  sm.yjs.wallsMap.set(next.id, next);
}

export async function updateWall(sm, id, patch) {
  requireGM(sm, 'edit a wall');
  const existing = sm.walls.get(id);
  if (!existing) return;
  const merged = { ...existing, ...patch, id };
  const next = _validateWritePayload(sm, merged, validateWall, 'wall');
  sm.yjs.wallsMap.set(id, next);
}

export async function removeWall(sm, id) {
  requireGM(sm, 'remove a wall');
  if (!sm.walls.has(id)) return;
  sm.yjs.wallsMap.delete(id);
}

export async function clearWalls(sm) {
  requireGM(sm, 'clear walls');
  const ids = [...sm.walls.keys()];
  sm.yjs.wallsMap.doc.transact(() => {
    for (const id of ids) sm.yjs.wallsMap.delete(id);
  });
}

export async function addLight(sm, light) {
  requireGM(sm, 'add a light');
  if (!light?.id) throw new Error('Light must have id');
  const next = _validateWritePayload(sm, light, validateLight, 'light');
  sm.yjs.lightsMap.set(next.id, next);
}

export async function updateLight(sm, id, patch) {
  requireGM(sm, 'edit a light');
  const existing = sm.lights.get(id);
  if (!existing) return;
  const merged = { ...existing, ...patch, id };
  const next = _validateWritePayload(sm, merged, validateLight, 'light');
  sm.yjs.lightsMap.set(id, next);
}

export async function removeLight(sm, id) {
  requireGM(sm, 'remove a light');
  if (!sm.lights.has(id)) return;
  sm.yjs.lightsMap.delete(id);
}

export async function clearLights(sm) {
  requireGM(sm, 'clear lights');
  const ids = [...sm.lights.keys()];
  sm.yjs.lightsMap.doc.transact(() => {
    for (const id of ids) sm.yjs.lightsMap.delete(id);
  });
}

export async function addPin(sm, pin) {
  requireGM(sm, 'add a pin');
  if (!pin?.id) throw new Error('Pin must have id');
  const next = _validateWritePayload(sm, pin, validatePin, 'pin');
  sm.yjs.pinsMap.set(next.id, next);
}

export async function updatePin(sm, id, patch) {
  requireGM(sm, 'edit a pin');
  const existing = sm.pins.get(id);
  if (!existing) return;
  const merged = { ...existing, ...patch, id };
  const next = _validateWritePayload(sm, merged, validatePin, 'pin');
  sm.yjs.pinsMap.set(id, next);
}

export async function removePin(sm, id) {
  requireGM(sm, 'remove a pin');
  if (!sm.pins.has(id)) return;
  sm.yjs.pinsMap.delete(id);
}

export async function addDrawing(sm, stroke) {
  requireGM(sm, 'draw on the map');
  pushDrawingHistory(sm);
  sm.yjs.drawingsArray.push([stroke]);
}

export async function removeDrawing(sm, id) {
  requireGM(sm, 'remove a drawing');
  const arr = sm.yjs.drawingsArray;
  const idx = arr.toArray().findIndex((s) => s.id === id);
  if (idx < 0) return;
  pushDrawingHistory(sm);
  arr.delete(idx, 1);
}

export async function clearDrawings(sm) {
  requireGM(sm, 'clear drawings');
  pushDrawingHistory(sm);
  const arr = sm.yjs.drawingsArray;
  if (arr.length > 0) arr.delete(0, arr.length);
}

export async function undoDrawing(sm) {
  requireGM(sm, 'undo a drawing');
  if (sm._drawingHistory.length === 0) return;
  sm._drawingFuture.push(JSON.stringify(sm.drawings));
  _replaceDrawings(sm, JSON.parse(sm._drawingHistory.pop()));
}

export async function redoDrawing(sm) {
  requireGM(sm, 'redo a drawing');
  if (sm._drawingFuture.length === 0) return;
  sm._drawingHistory.push(JSON.stringify(sm.drawings));
  _replaceDrawings(sm, JSON.parse(sm._drawingFuture.pop()));
}

function _replaceDrawings(sm, next) {
  const arr = sm.yjs.drawingsArray;
  arr.doc.transact(() => {
    if (arr.length > 0) arr.delete(0, arr.length);
    if (next.length > 0) arr.push(next);
  });
}

export function pushDrawingHistory(sm) {
  sm._drawingHistory.push(JSON.stringify(sm.drawings));
  if (sm._drawingHistory.length > 50) sm._drawingHistory.shift();
  sm._drawingFuture = [];
}
