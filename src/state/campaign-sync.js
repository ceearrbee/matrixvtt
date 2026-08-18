/**
 * campaign-sync.js - bulk seed + transport for full-campaign
 * import/export.
 *
 * Lives in the state layer because both `importCampaign` (local-only
 * reset from a JSON blob) and `syncCampaignToMatrix` (bulk push to the
 * room) intentionally touch every collection; enforcing per-entity
 * facade calls for each one would hand-roll the same iteration the
 * StateManager already owns. Kept as plain functions operating on a
 * StateManager so tests can seed a minimal sm without a real client.
 */

import { FOG_MODES } from '../utils/ui-constants.js';
import { fogSignal } from './signals.js';

const CAMPAIGN_FORMAT_VERSION = 1;

/**
 * Serialise all VTT state into a plain JSON-serialisable object.
 */
export function exportCampaign(state) {
  const mapOf = (m) => Array.from(m.entries()).map(([id, v]) => ({ id, ...v }));
  return {
    version: CAMPAIGN_FORMAT_VERSION,
    exported_at: Date.now(),
    settings: { ...state.settings },
    maps: mapOf(state.maps),
    tokens: mapOf(state.tokens),
    characters: mapOf(state.characters),
    npcs: mapOf(state.npcs),
    items: mapOf(state.items),
    spells: mapOf(state.spells),
    handouts: mapOf(state.handouts),
    tables: mapOf(state.tables),
    pins: mapOf(state.pins),
    walls: mapOf(state.walls ?? new Map()),
    templates: mapOf(state.templates ?? new Map()),
    fog: Object.fromEntries(
      Array.from(fogSignal.value.entries()).map(([id, f]) => [
        id,
        { ...f, revealed: [...(f?.revealed ?? [])] },
      ])
    ),
    initiative: { ...state.initiative, order: [...(state.initiative?.order ?? [])] },
    drawings: [...(state.drawings ?? [])],
    activeMapId: state.activeMapId ?? null,
  };
}

/**
 * Restore StateManager collections + singletons from an export blob.
 * Local-only - does not fire Matrix events. Used by dev reset and the
 * import-from-file flow, which calls `syncCampaignToMatrix` afterwards
 * to push to the room.
 */
export function importCampaign(state, data) {
  const buildMap = (entries) => {
    const m = new Map();
    for (const entry of (entries ?? [])) {
      const { id, ...rest } = entry;
      m.set(id, { id, ...rest });
    }
    return m;
  };

  state.settings = { ...state.settings, ...data.settings };
  state.maps.replace(buildMap(data.maps));
  state.tokens.replace(buildMap(data.tokens));
  state.characters.replace(buildMap(data.characters));
  state.npcs.replace(buildMap(data.npcs));
  state.items.replace(buildMap(data.items));
  state.spells.replace(buildMap(data.spells));
  state.handouts.replace(buildMap(data.handouts));
  state.tables.replace(buildMap(data.tables));
  
  if (state.pins) state.pins.replace(buildMap(data.pins));
  if (state.walls) state.walls.replace(buildMap(data.walls));
  if (state.templates) state.templates.replace(buildMap(data.templates));

  const rawFog = data.fog ?? { mode: FOG_MODES.HIDDEN, revealed: [] };
  if (rawFog.mode !== undefined) {
    // Legacy single-map export: restore under active map id or first map.
    const target = state.activeMapId || (state.maps.keys().next().value);
    if (target) {
      const next = new Map(fogSignal.value);
      next.set(target, rawFog);
      fogSignal.value = next;
    }
  } else {
    // Per-map export: restore all entries.
    const next = new Map();
    for (const [mapId, fogState] of Object.entries(rawFog)) {
      next.set(mapId, fogState);
    }
    fogSignal.value = next;
  }
  state.initiative = { ...(data.initiative ?? { active: false, round: 0, current_index: 0, order: [] }) };
  state.drawings = [...(data.drawings ?? [])];
  if (data.activeMapId !== undefined) state.activeMapId = data.activeMapId;
}

/**
 * Push the current StateManager content to Matrix in bulk after an
 * `importCampaign`. Routes every write through the facade (updateX,
 * updateSettings, updateFog, updateInitiative) so validation and the
 * Yjs writer path stay consistent with single-entry writes.
 */
export async function syncCampaignToMatrix(state, onProgress) {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 100));
  let step = 0;
  const tick = (label) => { step += 1; onProgress?.(step, label); };

  await state.updateSettings(state.settings);
  tick('settings');
  await wait();

  await _syncCollection(state.maps,       (id, v) => state.updateMap(id, v),       tick, 'map');
  await _syncCollection(state.characters, (id, v) => state.updateCharacter(id, v), tick, 'character');
  await _syncCollection(state.npcs,       (id, v) => state.updateNPC(id, v),       tick, 'npc');
  await _syncCollection(state.items,      (id, v) => state.updateItem(id, v),      tick, 'item');
  await _syncCollection(state.spells,     (id, v) => state.updateSpell(id, v),     tick, 'spell');
  await _syncCollection(state.tokens,     (id, v) => state.updateToken(id, v),     tick, 'token');

  // Push all per-map fog entries to Yjs in one transaction.
  state.yjs.fogMap.doc.transact(() => {
    for (const [mapId, fogState] of fogSignal.value) {
      const { base_version: _a, version: _b, ...rest } = fogState ?? {};
      state.yjs.fogMap.set(mapId, rest);
    }
  });
  tick('fog');
  await wait();
  await state.updateInitiative(state.initiative);
  tick('initiative');
  await wait();
  // Drawings live in sm.yjs.drawingsArray (Y.Array). Replace the array
  // contents transactionally so a single Yjs update broadcasts the
  // change instead of the legacy LWW DRAWING state event (which the
  // syncer ignores post-Yjs migration).
  const arr = state.yjs.drawingsArray;
  arr.doc.transact(() => {
    if (arr.length > 0) arr.delete(0, arr.length);
    if (state.drawings.length > 0) arr.push([...state.drawings]);
  });
  tick('drawings');
}

async function _syncCollection(map, writer, tick, label) {
  for (const [id, content] of map) {
    await writer(id, content);
    tick?.(`${label} ${id}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
