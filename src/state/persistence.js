/**
 * persistence.js - debounced-write helpers for interactive edits.
 *
 * `debouncedSend` coalesces rapid writes (HP slider, typed fields)
 * into one Yjs commit per 400ms. `updateEntityDebounced` layers an
 * optimistic local Map update on top so the UI reflects the change
 * immediately even though the Yjs commit is delayed.
 *
 * Both helpers must route to sm.yjs.<map>.set directly, never through
 * `sm.sendStateEvent` (LWW state events): that path is dead for entity
 * types - the syncer's YJS_ROUTED_TYPES skip drops them on read, so a
 * write lands but is never observed.
 */

import { EVENT_TYPES } from '../utils/constants.js';

const DEFAULT_DELAY_MS = 400;

const YJS_MAP_FOR_TYPE = {
  [EVENT_TYPES.TOKEN]:     'tokensMap',
  [EVENT_TYPES.CHARACTER]: 'charactersMap',
  [EVENT_TYPES.NPC]:       'npcsMap',
  [EVENT_TYPES.ITEM]:      'itemsMap',
  [EVENT_TYPES.SPELL]:     'spellsMap',
  [EVENT_TYPES.HANDOUT]:   'handoutsMap',
  [EVENT_TYPES.TABLE]:     'tablesMap',
  [EVENT_TYPES.WALL]:      'wallsMap',
  [EVENT_TYPES.PIN]:       'pinsMap',
  [EVENT_TYPES.TEMPLATE]:  'templatesMap',
  [EVENT_TYPES.MAP]:       'mapsMap',
};

function _key(type, stateKey) {
  return `${type}:${stateKey}`;
}

function _yjsCommit(sm, type, stateKey, content) {
  const mapName = YJS_MAP_FOR_TYPE[type];
  if (mapName) {
    sm.yjs[mapName].set(stateKey, content);
    return;
  }
  // Singleton Y.Maps (initiative, settings) live at key '' on the
  // matching Yjs map; fog is now per-map and uses the active map's id.
  if (type === EVENT_TYPES.FOG) {
    if (!sm.activeMapId) return;
    return sm.yjs.fogMap.set(sm.activeMapId, content);
  }
  if (type === EVENT_TYPES.INITIATIVE) return sm.yjs.initiativeMap.set('', content);
  if (type === EVENT_TYPES.SETTINGS)   return sm.yjs.settingsMap.set('', content);
  sm.sendStateEvent(type, stateKey, content);
}

export function debouncedSend(sm, type, stateKey, content, delay = DEFAULT_DELAY_MS) {
  const key = _key(type, stateKey);
  if (sm._debounceTimers.has(key)) clearTimeout(sm._debounceTimers.get(key));
  sm._debounceTimers.set(key, setTimeout(() => {
    sm._debounceTimers.delete(key);
    _yjsCommit(sm, type, stateKey, content);
  }, delay));
}

export function cancelDebouncedSend(sm, type, stateKey) {
  const key = _key(type, stateKey);
  const timer = sm._debounceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    sm._debounceTimers.delete(key);
  }
}

export function updateEntityDebounced(sm, type, id, content, delay = DEFAULT_DELAY_MS) {
  if (type === EVENT_TYPES.CHARACTER) sm.characters.set(id, content);
  else if (type === EVENT_TYPES.NPC) sm.npcs.set(id, content);
  debouncedSend(sm, type, id, content, delay);
}
