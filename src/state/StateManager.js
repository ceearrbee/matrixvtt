/**
 * StateManager - thin facade over the signal-backed state store.
 *
 * Entity collections are `ReactiveMap`s backed by module-level
 * signals in `./signals.js`; singletons are accessor pairs that
 * read/write the matching signal.value.
 */

import {
  tokensSignal, charactersSignal, npcsSignal, itemsSignal, spellsSignal,
  handoutsSignal, tablesSignal, mapsSignal, pagesSignal, fogSignal, initiativeSignal,
  settingsSignal, activeMapIdSignal, drawingsSignal, roomMembersSignal,
  pendingKnocksSignal,
  pinsSignal, templatesSignal, wallsSignal, lightsSignal,
} from './signals.js';
import { FOG_MODES } from '../utils/ui-constants.js';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal, selectedTokenSignal,
} from './ui-signals.js';
import { ReactiveMap } from './reactive-map.js';
import { resetSignals } from './state-init.js';
import { YjsManager } from './YjsManager.js';
import * as reader from './reader.js';
import * as writer from './writer.js';
import * as syncer from './syncer.js';
import * as lifecycle from './lifecycle.js';
import * as persistence from './persistence.js';
import { initBlankCampaign as _initBlankCampaign } from './campaign-init.js';
import { getGameSystemPresets } from './rulesets.js';
import { wireYjsBridges } from './stateManager-yjs-bridges.js';
import { clearAllState, clearInternalSyncState } from './stateManager-clear.js';
import { logger } from '../utils/logger.js';
import { awaitQueueDrain as awaitQueueDrainFn } from './queue.js';

export class StateManager {
  static getGameSystemPresets() { return getGameSystemPresets(); }

  constructor(widgetManager, subscriptionManager) {
    this.widgetManager = widgetManager;
    this.subscriptionManager = subscriptionManager;
    this.loaded = false;

    // Module-level signals persist across test runs; must reset.
    resetSignals();

    // Collaborative state: the Yjs doc behind every entity collection.
    this.yjs = new YjsManager(widgetManager.roomId);

    // Entity collections are ReactiveMap wrappers over module signals.
    this.tokens     = new ReactiveMap(tokensSignal);
    this.characters = new ReactiveMap(charactersSignal);
    this.npcs       = new ReactiveMap(npcsSignal);
    this.items      = new ReactiveMap(itemsSignal);
    this.spells     = new ReactiveMap(spellsSignal);
    this.handouts   = new ReactiveMap(handoutsSignal);
    this.tables     = new ReactiveMap(tablesSignal);
    this.maps       = new ReactiveMap(mapsSignal);
    this.pages      = new ReactiveMap(pagesSignal);
    this.pins       = new ReactiveMap(pinsSignal);
    this.templates  = new ReactiveMap(templatesSignal);
    this.walls      = new ReactiveMap(wallsSignal);
    this.lights     = new ReactiveMap(lightsSignal);

    // Metadata about sync progress and errors
    this.lastSentState = new Map();
    this._retryQueue = new Map();
    this._debounceTimers = new Map();
    this._drainTimer = null;
    this._cleaningUp = false;
    this.refreshing = false;

    // Local-only state (non-synced)
    this._drawingHistory = [];
    this._drawingFuture  = [];
    this.damageLog       = [];

    // Wire Yjs → ReactiveMap bridges immediately. These have no async
    // dependencies; doing them in init() left a window where bulk writes
    // (e.g. initBlankCampaign) could land in Y.Maps before the bridge mirror
    // was listening, so the priming bridge fire would treat populated
    // local state as "extras" and wipe it.
    this._wireYjsBridges();
  }

  get fog() {
    const id = this.activeMapId;
    if (!id) return { mode: FOG_MODES.HIDDEN, revealed: [] };
    return fogSignal.value.get(id) ?? { mode: FOG_MODES.HIDDEN, revealed: [] };
  }

  set fog(v) {
    const id = this.activeMapId;
    if (!id) return;
    const next = new Map(fogSignal.value);
    next.set(id, v);
    fogSignal.value = next;
  }

  fogFor(mapId) {
    if (!mapId) return { mode: FOG_MODES.HIDDEN, revealed: [] };
    return fogSignal.value.get(mapId) ?? { mode: FOG_MODES.HIDDEN, revealed: [] };
  }
  get initiative()    { return initiativeSignal.value; }
  set initiative(v)   { initiativeSignal.value = v; }
  get settings()      { return settingsSignal.value; }
  set settings(v)     { settingsSignal.value = v; }
  get activeMapId()   { return activeMapIdSignal.value; }
  set activeMapId(v)  { activeMapIdSignal.value = v; }
  get drawings()      { return drawingsSignal.value; }
  set drawings(v)     { drawingsSignal.value = v; }
  get roomMembers()   { return roomMembersSignal.value; }
  set roomMembers(v)  { roomMembersSignal.value = v; }
  get pendingKnocks()  { return pendingKnocksSignal.value; }
  set pendingKnocks(v) { pendingKnocksSignal.value = v; }

  get selectedCharacterId()   { return selectedCharacterIdSignal.value; }
  set selectedCharacterId(v)  { selectedCharacterIdSignal.value = v; }
  get selectedNPCId()         { return selectedNPCIdSignal.value; }
  set selectedNPCId(v)        { selectedNPCIdSignal.value = v; }
  get selectedToken()         { return selectedTokenSignal.value; }
  set selectedToken(v)        { selectedTokenSignal.value = v; }

  async init() {
    logger.log('State', 'Initializing StateManager');
    await this.widgetManager.init(this.yjs);
    return lifecycle.init(this);
  }

  _wireYjsBridges() { wireYjsBridges(this); }

  async refreshState() { return lifecycle.refreshState(this); }
  destroy() {
    this.yjs.destroy();
    return lifecycle.destroy(this);
  }
  async _refreshMembers() { return lifecycle.refreshMembers(this); }

  loadInitialState() { return syncer.loadInitialState(this); }
  subscribeToStateEvents() { return syncer.subscribeToStateEvents(this); }

  async sendStateEvent(type, key, content) {
    if (this._cleaningUp) return;
    return syncer.sendStateEvent(this, type, key, content);
  }

  async sendRoomEvent(type, content) {
    if (this._cleaningUp) return;
    return syncer.sendRoomEvent(this, type, content);
  }

  async awaitQueueDrain(timeoutMs = 15000) {
    return awaitQueueDrainFn(this, timeoutMs);
  }

  handleStateEvent(event) {
    return syncer.handleStateEvent(this, event);
  }

  debouncedSend(type, key, content, delay) {
    return persistence.debouncedSend(this, type, key, content, delay);
  }

  cancelDebouncedSend(type, key) {
    return persistence.cancelDebouncedSend(this, type, key);
  }

  updateEntityDebounced(type, id, content, delay) {
    return persistence.updateEntityDebounced(this, type, id, content, delay);
  }

  get map()       { return reader.getActiveMap(this); }
  isGM()          { return reader.isGM(this); }
  canMoveToken(id) { return reader.canMoveToken(this, id); }
  isTokenVisibleToPlayer(token, revealedSet) { return reader.isTokenVisibleToPlayer(this, token, revealedSet); }
  hasTokenForSheet(id) { return reader.hasTokenForSheet(this, id); }
  canEditEntity(entity) { return reader.canEditEntity(this, entity); }
  getCurrentCharacter() { return reader.getCurrentCharacter(this); }
  getCurrentCharacterId() { return reader.getCurrentCharacterId(this); }
  getCurrentNPC() { return reader.getCurrentNPC(this); }
  getCurrentNPCId() { return reader.getCurrentNPCId(this); }
  getCurrentSpells() { return reader.getCurrentSpells(this); }

  updateToken(id, val)        { return writer.updateToken(this, id, val); }
  updateTokenPosition(id, c, r) { return writer.updateTokenPosition(this, id, c, r); }
  deleteToken(id)             { return writer.deleteToken(this, id); }

  updateCharacter(id, val)    { return writer.updateCharacter(this, id, val); }
  removeCharacter(id)         { return writer.deleteCharacter(this, id); }
  deleteCharacter(id)         { return writer.deleteCharacter(this, id); }

  updateNPC(id, val)          { return writer.updateNPC(this, id, val); }
  removeNPC(id)               { return writer.deleteNPC(this, id); }
  deleteNPC(id)               { return writer.deleteNPC(this, id); }

  updateItem(id, val)         { return writer.updateItem(this, id, val); }
  removeItem(id)              { return writer.deleteItem(this, id); }
  deleteItem(id)              { return writer.deleteItem(this, id); }

  updateSpell(id, val)        { return writer.updateSpell(this, id, val); }
  removeSpell(id)             { return writer.deleteSpell(this, id); }
  deleteSpell(id)             { return writer.deleteSpell(this, id); }

  updateHandout(id, val)      { return writer.updateHandout(this, id, val); }
  removeHandout(id)           { return writer.deleteHandout(this, id); }
  deleteHandout(id)           { return writer.deleteHandout(this, id); }

  updateTable(id, val)        { return writer.updateTable(this, id, val); }
  removeTable(id)             { return writer.deleteTable(this, id); }
  deleteTable(id)             { return writer.deleteTable(this, id); }

  updatePage(id, val)         { return writer.updatePage(this, id, val); }
  removePage(id)              { return writer.deletePage(this, id); }
  deletePage(id)              { return writer.deletePage(this, id); }
  setPageThreadRoot(id, eid)  { return writer.setPageThreadRoot(this, id, eid); }

  updateMap(id, val)          { return writer.updateMap(this, id, val); }
  deleteMap(id)               { return writer.deleteMap(this, id); }
  setActiveMap(id)            { return writer.setActiveMap(this, id); }
  switchMap(id)               { return writer.switchMap(this, id); }
  createMap(config)           { return writer.createMap(this, config); }
  duplicateMap(id)            { return writer.duplicateMap(this, id); }

  updateFog(val)              { return writer.updateFog(this, val); }

  updateSettings(val)         { return writer.updateSettings(this, val); }
  updateInitiative(val)       { return writer.updateInitiative(this, val); }
  clearInitiative()           { return writer.clearInitiative(this); }

  addDrawing(stroke)          { return writer.addDrawing(this, stroke); }
  removeDrawing(id)           { return writer.removeDrawing(this, id); }
  clearDrawings()             { return writer.clearDrawings(this); }
  undoDrawing()               { return writer.undoDrawing(this); }
  redoDrawing()               { return writer.redoDrawing(this); }

  addWall(wall)               { return writer.addWall(this, wall); }
  updateWall(id, patch)       { return writer.updateWall(this, id, patch); }
  removeWall(id)              { return writer.removeWall(this, id); }
  clearWalls()                { return writer.clearWalls(this); }

  addLight(light)             { return writer.addLight(this, light); }
  updateLight(id, patch)      { return writer.updateLight(this, id, patch); }
  removeLight(id)             { return writer.removeLight(this, id); }
  clearLights()               { return writer.clearLights(this); }

  addPin(pin)                 { return writer.addPin(this, pin); }
  updatePin(id, patch)        { return writer.updatePin(this, id, patch); }
  removePin(id)               { return writer.removePin(this, id); }

  addTemplate(template)       { return writer.addTemplate(this, template); }
  updateTemplate(id, patch)   { return writer.updateTemplate(this, id, patch); }
  removeTemplate(id)          { return writer.removeTemplate(this, id); }
  clearTemplates()            { return writer.clearTemplates(this); }

  recordDamage(entry)         { return writer.recordDamage(this, entry); }

  initBlankCampaign(name, sys) { return _initBlankCampaign(this, name, sys); }

  setCleaningUp(v) { this._cleaningUp = v; }
  _clearAllState(opts) { clearAllState(this, opts); }
  _clearInternalSyncState() { clearInternalSyncState(this); }
}
