/**
 * setup-tombstone.js - planning + execution of the bulk delete that
 * `deleteSession` and the first-time-setup wizard run to clear a room's
 * prior state.
 *
 * Extracted from `first-time-setup.js` so its ~150 lines of Matrix
 * cleanup policy don't mix with modal-rendering code.
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export function _countResidualEntities(ui) {
  const s = ui.state;
  // Sum every collection a tombstone sweep will touch. The original
  // count excluded spells / drawings / walls / templates / pins,
  // which let the wizard's residual banner under-count the room.
  // A user could see "0 entities" and confirm a wipe that destroyed
  // dozens of unaccounted-for items. Per the production audit's
  // wizard-data-loss cluster: keep this list aligned with every
  // entity-typed collection on StateManager.
  const drawings = Array.isArray(s.drawings) ? s.drawings.length : 0;
  return (s.tokens?.size ?? 0)
    + (s.characters?.size ?? 0)
    + (s.npcs?.size ?? 0)
    + (s.items?.size ?? 0)
    + (s.spells?.size ?? 0)
    + (s.handouts?.size ?? 0)
    + (s.tables?.size ?? 0)
    + (s.walls?.size ?? 0)
    + (s.templates?.size ?? 0)
    + (s.pins?.size ?? 0)
    + (s.lights?.size ?? 0)
    + (s.pages?.size ?? 0)
    + (s.maps?.size ?? 0)
    + drawings;
}

/**
 * Collect every VTT entity that needs tombstoning before the wizard
 * seeds a new campaign. VTT data lives in Yjs Y.Maps; iterate the local
 * ReactiveMaps (mirrors of those Y.Maps) and surface the ids that need
 * tombstoning via the per-type writers below.
 */
export async function _fetchStaleVttEvents(ui) {
  const out = [];
  const push = (type, id) => { if (id !== '') out.push({ type, id }); };
  for (const { type, map } of _localYjsCollections(ui)) {
    if (map?.forEach) map.forEach((_, id) => push(type, id));
  }
  return out;
}

function _localYjsCollections(ui) {
  return [
    { type: EVENT_TYPES.TOKEN,     map: ui.state.tokens },
    { type: EVENT_TYPES.CHARACTER, map: ui.state.characters },
    { type: EVENT_TYPES.NPC,       map: ui.state.npcs },
    { type: EVENT_TYPES.ITEM,      map: ui.state.items },
    { type: EVENT_TYPES.SPELL,     map: ui.state.spells },
    { type: EVENT_TYPES.HANDOUT,   map: ui.state.handouts },
    { type: EVENT_TYPES.TABLE,     map: ui.state.tables },
    { type: EVENT_TYPES.MAP,       map: ui.state.maps },
    { type: EVENT_TYPES.PIN,       map: ui.state.pins },
    { type: EVENT_TYPES.TEMPLATE,  map: ui.state.templates },
    { type: EVENT_TYPES.WALL,      map: ui.state.walls },
    { type: EVENT_TYPES.LIGHT,     map: ui.state.lights },
    { type: EVENT_TYPES.PAGE,      map: ui.state.pages },
  ];
}

/**
 * Tombstone a list of {type, id} state events with 150ms gaps.
 * Serialized to avoid rate limits; individual failures are logged but
 * don't abort the batch.
 */
export async function tombstoneOldEntities(ui, tokenIds, charIds, npcIds, itemIds, handoutIds = [], tableIds = [], mapIds = []) {
  const targets = [
    ...tokenIds.map((id)   => ({ type: EVENT_TYPES.TOKEN,     id })),
    ...charIds.map((id)    => ({ type: EVENT_TYPES.CHARACTER, id })),
    ...npcIds.map((id)     => ({ type: EVENT_TYPES.NPC,       id })),
    ...itemIds.map((id)    => ({ type: EVENT_TYPES.ITEM,      id })),
    ...handoutIds.map((id) => ({ type: EVENT_TYPES.HANDOUT,   id })),
    ...tableIds.map((id)   => ({ type: EVENT_TYPES.TABLE,     id })),
    ...mapIds.map((id)     => ({ type: EVENT_TYPES.MAP,       id })),
  ];
  return tombstoneStaleEvents(ui, targets);
}

export async function tombstoneStaleEvents(ui, targets, onProgress) {
  const firstPass = await _tombstoneOnce(ui, targets, onProgress, 0);
  if (firstPass.length === 0) return firstPass;

  await new Promise((r) => setTimeout(r, 500));
  const retryTargets = firstPass.map((f) => ({ type: f.type, id: f.id }));
  return _tombstoneOnce(ui, retryTargets, onProgress, targets.length - firstPass.length);
}

// Tombstone a server event by dispatching to the matching facade
// writer. Event type is only known at runtime from room enumeration,
// hence the dispatch table.
const _TOMBSTONE_WRITERS = {
  [EVENT_TYPES.TOKEN]:     (sm, id) => sm.updateToken(id, {}),
  [EVENT_TYPES.CHARACTER]: (sm, id) => sm.removeCharacter(id),
  [EVENT_TYPES.NPC]:       (sm, id) => sm.removeNPC(id),
  [EVENT_TYPES.ITEM]:      (sm, id) => sm.removeItem(id),
  [EVENT_TYPES.SPELL]:     (sm, id) => sm.removeSpell(id),
  [EVENT_TYPES.HANDOUT]:   (sm, id) => sm.removeHandout(id),
  [EVENT_TYPES.TABLE]:     (sm, id) => sm.removeTable(id),
  [EVENT_TYPES.MAP]:       (sm, id) => sm.deleteMap(id),
  [EVENT_TYPES.PIN]:       (sm, id) => sm.removePin(id),
  [EVENT_TYPES.TEMPLATE]:  (sm, id) => sm.removeTemplate(id),
  [EVENT_TYPES.WALL]:      (sm, id) => sm.removeWall(id),
  [EVENT_TYPES.LIGHT]:     (sm, id) => sm.removeLight(id),
  [EVENT_TYPES.PAGE]:      (sm, id) => sm.deletePage(id),
};

async function _tombstoneOnce(ui, targets, onProgress, doneOffset) {
  const failures = [];
  for (let i = 0; i < targets.length; i++) {
    const { type, id } = targets[i];
    try {
      const writer = _TOMBSTONE_WRITERS[type];
      if (writer) await writer(ui.state, id);
    } catch (err) {
      logger.error('UI', `[tombstone] failed: ${type}#${id}`, err);
      failures.push({ type, id, err });
    }
    onProgress?.(doneOffset + i + 1, `${type} ${id}`);
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  return failures;
}
