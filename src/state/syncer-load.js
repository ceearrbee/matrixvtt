/**
 * Initial-load helpers for syncer.loadInitialState.
 *
 * clearAllCollections: pre-replay reset so a refresh starts from a
 * blank slate. It must enumerate every entity collection.
 */

export function clearAllCollections(sm) {
  sm.tokens.clear();
  sm.characters.clear();
  sm.npcs.clear();
  sm.items.clear();
  sm.spells.clear();
  sm.handouts.clear();
  sm.pages?.clear();
  sm.tables.clear();
  sm.pins.clear();
  sm.templates?.clear();
  sm.walls?.clear();
  sm.lights?.clear();
  sm.maps.clear();
  sm.drawings = [];
  sm.roomMembers = [];
  sm.pendingKnocks = [];
  sm.damageLog = [];
  sm.activeMapId = null;
}
