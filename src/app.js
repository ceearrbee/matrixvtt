/**
 * MatrixVTT - Main Application Entry Point
 * Matrix widget bootstrap using @matrix-widget-toolkit/api
 */

import { initRemoteLogging } from './utils/remoteLogger.js';
import { WidgetManager } from './widget/WidgetManager.js';
import { SubscriptionManager } from './widget/SubscriptionManager.js';
import { StateManager } from './state/StateManager.js';
import { createUI } from './ui/ui-methods.js';
import { ChatIntegrator } from './chat-integrator.js';
import { DiceRoller } from './dice-roller.js';
import { showErrorNotification } from './utils/errorHandling.js';
import { renderFatalError } from './utils/appErrorView.js';
import { showSyncDeadBanner } from './ui/sync-status.js';
import { applyAccessibilitySettings } from './ui/settings-helpers.js';
import { logger } from './utils/logger.js';
import { VTT_EVENTS } from './utils/constants.js';

// Initialize remote logging (sends console logs to terminal)
initRemoteLogging();

// Apply saved accessibility preferences immediately (before first render)
applyAccessibilitySettings();

export class MatrixVTT {
  constructor() {
    this.widgetManager = null;
    this.state = null;
    this.ui = null;
    this.chat = null;
    this.diceRoller = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Matrix widget
   *
   * CRITICAL: WidgetManager must be created FIRST for Safari compatibility
   */
  async init() {
    try {
      this.widgetManager = new WidgetManager();
      await this.widgetManager.init();

      const subscriptionManager = new SubscriptionManager();
      this.state = new StateManager(this.widgetManager, subscriptionManager);
      await this.state.init();

      this.diceRoller = new DiceRoller(this.state);
      this.chat = new ChatIntegrator(this.widgetManager, this.state, this.diceRoller);
      this.chat.init();

      this.ui = createUI(this.state, this.widgetManager, this.chat);
      this.ui.render();

      if (import.meta.env.DEV) _setupDevHelpers(this);

      this.isInitialized = true;
      logger.log('MatrixVTT', 'Initialized');
    } catch (error) {
      showErrorNotification(error);
      this.showError('Failed to initialize: ' + error.message);
    }
  }

  showError(message) {
    const app = document.getElementById('app');
    if (!app) { logger.error('MatrixVTT', message); return; }
    renderFatalError(app, message);
  }
}

function _setupDevHelpers(app) {
  window.ui = app.ui;
  window.__vttReset = async (name = 'New Campaign', system = 'dnd5e') => {
    const staleKeys = {
      tokens: [...app.state.tokens.keys()],
      chars:  [...app.state.characters.keys()],
      npcs:   [...app.state.npcs.keys()],
      items:  [...app.state.items.keys()],
      hands:  [...app.state.handouts.keys()],
      tables: [...app.state.tables.keys()],
      maps:   [...app.state.maps.keys()].filter(id => id !== '')
    };
    app.state.initBlankCampaign(name, system);
    app.state.setCleaningUp(true);
    try {
      await app.ui._tombstoneOldEntities(staleKeys.tokens, staleKeys.chars, staleKeys.npcs, staleKeys.items, staleKeys.hands, staleKeys.tables, staleKeys.maps);
    } finally {
      app.state.setCleaningUp(false);
    }
    await app.ui.saveInitialState();
    window.location.reload();
  };
}

export function bootstrapMatrixVTT(doc = document, win = window) {
  _setupGlobalListeners(doc, win);

  const start = () => {
    win.matrixVTT = new MatrixVTT();
    win.matrixVTT.init();
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function _setupGlobalListeners(doc, win) {
  win.addEventListener(VTT_EVENTS.CAPABILITIES_DENIED, (e) => {
    const app = doc.getElementById('app');
    if (!app) return;
    renderFatalError(app, {
      title: 'Widget permissions denied',
      lines: e.detail?.missing ?? [],
      hint: 'MatrixVTT needs these permissions to sync the table. Reopen the widget and accept all permission prompts.',
    });
  }, { once: true });

  win.addEventListener(VTT_EVENTS.ROOM_UPGRADED, (e) => {
    const app = doc.getElementById('app');
    if (!app) return;
    renderFatalError(app, {
      title: 'Room upgraded',
      lines: e.detail?.replacementRoomId ? [e.detail.replacementRoomId] : [],
      hint: 'The Matrix room has been migrated. Add the VTT widget to the new room.',
    });
  }, { once: true });

  win.addEventListener(VTT_EVENTS.SYNC_DEAD, () => {
    const app = doc.getElementById('app');
    if (app) showSyncDeadBanner(app, () => win.location.reload());
  }, { once: true });
}

if (!window.__MVTT_DISABLE_AUTO_INIT__) {
  bootstrapMatrixVTT();
}
