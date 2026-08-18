/**
 * ui-methods.js - attaches all UIController render/setup/delegation methods
 * onto a given `ui` object. Separated so tests can construct a minimal ui
 * without triggering the full UIController lifecycle (window listeners,
 * DiceRoller, chat bindings).
 */

import { attachMapControls } from './map-controls-wiring.js';
import { attachEventHandlers } from './event-wiring.js';
import { attachIOMethods } from './io-wiring.js';
import { attachModalMethods } from './modal-wiring.js';
import { attachCombatMethods } from './combat-wiring.js';
import { attachDataMethods } from './data-wiring.js';
import { attachGMMethods } from './gm-wiring.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import {
  renderUI as renderUIFn,
  setupResizeHandlers as setupResizeHandlersFn,
  initUIController as initUIControllerFn,
  destroyUI as destroyUIFn,
  sendChatMessage as sendChatMessageFn,
} from './ui-lifecycle.js';
import { announce as announceFn, toast as toastFn } from './notifications.js';
import { log as logFn, findTokenForSender as findTokenForSenderFn } from './log-panel.js';
import { downloadMarkdown as downloadMarkdownFn } from './import-export.js';
import { renderTemplatePicker as renderTemplatePickerFn } from './entity-forms.js';
import {
  tombstoneOldEntities as tombstoneOldEntitiesFn,
  saveInitialState as saveInitialStateFn,
} from './first-time-setup.js';
import {
  toggleDebugMode as toggleDebugModeFn,
  copyDebugToken as copyDebugTokenFn,
  syncDisplayName as syncDisplayNameFn,
  updateSyncBanner as updateSyncBannerFn,
  clearDebugStorage as clearDebugStorageFn,
  hardReload as hardReloadFn,
} from './sync-status.js';
import {
  selectToken as selectTokenFn,
  selectTokenAndSwitchTab,
  switchTab as switchTabFn,
  startTurnTimer,
  stopTurnTimer,
} from './tab-navigation.js';
import {
  restoreTheme as restoreThemeFn,
  toggleTheme as toggleThemeFn,
} from './theme.js';
import {
  collectSpellSlots,
  collectAttributeValues,
} from './sheet-renderers.js';
import {
  calcModifier,
  deriveCharacterSaves,
} from './character-calculations.js';
import {
  selectCharacterById as selectCharacterByIdFn,
  selectNPCById as selectNPCByIdFn,
} from './entity-manager.js';
import { isMyCombatTurn } from './combat-manager.js';
import { secretRollSignal, speakAsSignal } from "../state/ui-signals.js";

export function attachUIMethods(ui) {
  ui.render = () => renderUIFn(ui);
  ui.setupResizeHandlers = () => setupResizeHandlersFn(ui);

  attachMapControls(ui);
  attachEventHandlers(ui);
  attachModalMethods(ui);
  attachIOMethods(ui);
  ui.setSpeakAs = (value) => {
    speakAsSignal.value = value ?? '';
  };

  ui.selectToken = (id) => selectTokenFn(ui, id);
  ui._selectTokenAndSwitchTab = (id) => selectTokenAndSwitchTab(ui, id);
  ui.switchTab = (tab) => switchTabFn(ui, tab);
  ui.selectCharacterById = (id, opts) => selectCharacterByIdFn(ui, id, opts);
  ui.selectNPCById = (id, opts) => selectNPCByIdFn(ui, id, opts);
  ui.clearSelectedNPC = () => {
    ui.state.selectedNPCId = null;
  };

  attachDataMethods(ui);
  attachCombatMethods(ui);
  attachGMMethods(ui);

  ui._log = (icon, html, opts) => logFn(ui, icon, html, opts);
  ui._findTokenForSender = (userId) => findTokenForSenderFn(ui, userId);
  ui.sendChatMessage = (value) => sendChatMessageFn(ui, value);
  ui.downloadMarkdown = (content, filename) => downloadMarkdownFn(ui, content, filename);
  ui._renderTemplatePicker = () => renderTemplatePickerFn(ui);
  ui._tombstoneOldEntities = (tokens, chars, npcs, items, handouts, tables, maps) =>
    tombstoneOldEntitiesFn(ui, tokens, chars, npcs, items, handouts, tables, maps);
  ui.saveInitialState = () => saveInitialStateFn(ui);
  ui.kickUser = (userId, reason) => ui.widgetManager?.kickUser?.(userId, reason);
  ui.banUser = (userId, reason) => ui.widgetManager?.banUser?.(userId, reason);
  ui.undoDrawing = () => { if (ui.state.isGM()) return ui.state.undoDrawing(); };
  ui.redoDrawing = () => { if (ui.state.isGM()) return ui.state.redoDrawing(); };
  ui._getSystemAttrs = () => ui.state?.settings?.systemConfig?.attributes ?? [];
  ui._announce = (msg) => announceFn(ui, msg);
  ui._toast = (msg, type) => toastFn(ui, msg, type);
  ui._syncDisplayName = () => syncDisplayNameFn(ui);
  ui._calcModifier = (s) => calcModifier(ui.state.settings.systemConfig, s);
  ui._deriveCharacterSaves = (c) => deriveCharacterSaves(ui.state.settings.systemConfig, c);
  ui._isMyCombatTurn = () => isMyCombatTurn(ui);
  ui.toggleSecretRoll = () => { secretRollSignal.value = !secretRollSignal.value; };
  ui._startTurnTimer = () => startTurnTimer(ui);
  ui._stopTurnTimer = () => stopTurnTimer(ui);

  ui.restoreTheme = () => restoreThemeFn();
  ui.toggleTheme = () => toggleThemeFn(ui);
  ui.shouldShowMapHelp = () => localStorage.getItem(STORAGE_KEYS.HIDE_MAP_HELP) !== '1';
  ui.dismissMapHelp = () => { localStorage.setItem(STORAGE_KEYS.HIDE_MAP_HELP, '1'); ui.render(); };

  Object.defineProperty(ui, '_debugMode', {
    configurable: true,
    get() {
      try {
        return localStorage.getItem(STORAGE_KEYS.DEBUG) === '1'
          || new URLSearchParams(location.search).get('debug') === '1';
      } catch { return false; }
    },
  });
  ui.toggleDebugMode = () => toggleDebugModeFn(ui);
  ui._copyDebugToken = () => copyDebugTokenFn(ui);
  ui._clearDebugStorage = () => clearDebugStorageFn(ui);
  ui._hardReload = () => hardReloadFn();

  ui._updateSyncBanner = () => updateSyncBannerFn(ui);
  ui._refreshApiStatus = () => {}; // No-op: component handles refresh

  ui._collectSpellSlots = (modal) => collectSpellSlots(ui, modal);
  ui._collectAttributeValues = (modal) => collectAttributeValues(ui, modal);

  ui._setupTemplatePickerHandlers = (root = document) => {
    root.querySelector('#template-select')?.addEventListener('change', (e) => ui.applyCharacterTemplate(e.target.value));
    root.querySelector('#delete-template-btn')?.addEventListener('click', () => {
      const val = root.querySelector('#template-select')?.value;
      if (val) ui.deleteCharacterTemplate(val);
    });
  };

  return ui;
}

/**
 * Build a ui object without running the initUIController lifecycle (no
 * window event listeners, no DiceRoller, no chat bindings). Useful for
 * tests that want to invoke render/setup methods without side effects.
 */
export function createUI(state, widgetManager, chat = null) {
  const ui = {};
  attachUIMethods(ui);
  initUIControllerFn(ui, state, widgetManager, chat);
  ui.destroy = () => destroyUIFn(ui);
  return ui;
}

export function createMinimalUI(state, widgetManager, chat = null) {
  const ui = {
    state,
    widgetManager,
    chat,
    mapRenderer: null,
    activityLog: [],
    _logFilter: 'all',
    _logSearch: '',
    _logLoadingHistory: false,
    _seenLogEventIds: new Set(),
    _turnStartMs: null,
    _turnTimerInterval: null,
    _lastSetDisplayName: null,
    _syncDisplayNameTimer: null,
  };
  attachUIMethods(ui);
  return ui;
}
