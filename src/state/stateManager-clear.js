/**
 * Collection-clearing helpers for StateManager. Kept as a separate
 * module so the enumerated list of collections lives next to the
 * regression test that pins it (clearAllCollectionsRegression.test.js).
 *
 * Note: `clearAllState` MUST enumerate every collection on the
 * StateManager instance - entity maps, the transcripts beside them, the
 * undo stacks, and the queued work that would otherwise land after the
 * wipe. Adding a new collection without listing it here causes a
 * cross-room leak. `clearAllCollectionsRegression.test.js` walks the
 * instance and fails on anything left holding something.
 */

import { resetSignals } from './state-init.js';

const YJS_KEYED_MAPS = [
  'tokensMap', 'charactersMap', 'npcsMap', 'itemsMap', 'spellsMap',
  'handoutsMap', 'tablesMap', 'pinsMap', 'templatesMap', 'wallsMap',
  'lightsMap', 'mapsMap', 'pagesMap',
];
const YJS_SINGLETON_MAPS = ['fogMap', 'initiativeMap', 'settingsMap'];

/**
 * Clear all local entity collections, plus optionally the Yjs Y.Maps
 * that back them.
 *
 * @param {object} sm - StateManager instance.
 * @param {{ clearYjs?: boolean }} [opts]
 *   When `clearYjs` is true, every Y.Map (keyed + singleton) and the
 *   drawings Y.Array are also cleared inside one `sm.yjs.doc.transact`
 *   so the bridge mirrors a single coherent reset and the transport
 *   broadcasts one delete-all update.
 *
 *   Default false: caller is just resetting LOCAL state ahead of a
 *   teardown that will GC the Y.Doc anyway (e.g. `app-client.destroy`).
 *   Clearing Y.Maps in that path would spam other clients with a
 *   delete-all update right before disconnect.
 */
export function clearAllState(sm, opts = {}) {
  if (opts.clearYjs && sm.yjs) {
    sm.yjs.doc.transact(() => {
      for (const name of YJS_KEYED_MAPS) sm.yjs[name]?.clear();
      for (const name of YJS_SINGLETON_MAPS) sm.yjs[name]?.clear();
      const arr = sm.yjs.drawingsArray;
      if (arr && arr.length > 0) arr.delete(0, arr.length);
    });
  }
  sm.tokens.clear();
  sm.characters.clear();
  sm.npcs.clear();
  sm.items.clear();
  sm.spells.clear();
  sm.handouts.clear();
  sm.tables.clear();
  sm.pins.clear();
  sm.templates.clear();
  sm.walls.clear();
  sm.lights?.clear();
  sm.maps.clear();
  sm.pages?.clear();
  sm.drawings = [];
  sm.roomMembers = [];
  sm.activeMapId = null;
  // The damage panel is one campaign's history, not the next one's.
  sm.damageLog = [];
  // Undo WRITES. Left in place, Ctrl+Z after a campaign reset pushes the
  // previous campaign's drawings back into the room that just replaced it.
  sm._drawingHistory = [];
  sm._drawingFuture = [];
  // The two paths that wipe a campaign - initBlankCampaign and the
  // delete-campaign flow - keep this StateManager alive, so `destroy()`
  // never runs and anything already queued would land on the far side of
  // the wipe and re-create what was deleted.
  clearInternalSyncState(sm);
  resetSignals();
}

export function clearInternalSyncState(sm) {
  // Purge local retry state when room switches, to avoid state leaks
  // during /rejoin or tombstone jumps. matrix-js-sdk's own event
  // store handles transport-level dedup; we don't keep our own set.
  sm.lastSentState.clear();
  sm._retryQueue.clear();
  for (const timer of sm._debounceTimers.values()) clearTimeout(timer);
  sm._debounceTimers.clear();
  if (sm._drainTimer) { clearTimeout(sm._drainTimer); sm._drainTimer = null; }
}
