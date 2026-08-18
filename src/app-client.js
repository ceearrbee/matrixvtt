/**
 * MatrixVTT Standalone Client - Entry Point
 * Mirrors app.js but uses ClientManager instead of WidgetManager.
 * Does NOT auto-initialize - app.html drives the login flow and calls initVTT().
 *
 * The post-login VTT runtime is statically imported, not loaded via
 * `import()` at Resume time. The dynamic-import variant failed under
 * the mobile-Firefox flaky-LAN pattern:
 * once Firefox's HTTP/2 pool holds a dead TCP socket (typical after a
 * WiFi flap), every subsequent fetch to that origin fast-fails for
 * tens of seconds. Statically importing the chain means the modules
 * are already in memory when Resume is tapped - zero network round-
 * trips, zero exposure to that failure mode. The auth bundle pays the
 * one-time cost; the service worker caches it on production for free.
 */

import { initRemoteLogging } from './utils/remoteLogger.js';
import { showSyncDeadBanner } from './ui/sync-status.js';
import { applyAccessibilitySettings } from './ui/settings-helpers.js';
import { logger } from './utils/logger.js';
import { VTT_EVENTS } from './utils/constants.js';

import { ClientManager } from './client/ClientManager.js';
import { SubscriptionManager } from './widget/SubscriptionManager.js';
import { StateManager } from './state/StateManager.js';
import { createUI } from './ui/ui-methods.js';
import { ChatIntegrator } from './chat-integrator.js';
import { DiceRoller } from './dice-roller.js';
import { clientManagerHasSnapshot } from './utils/room-snapshot-probe.js';

initRemoteLogging();

// Re-apply the saved accessibility settings (theme, reduced-motion,
// high-contrast) at runtime. The inline preload in app.html already
// flips `data-theme` before first paint to avoid a FOUC; this call
// covers the classlist toggles (reduced-motion, high-contrast) and
// re-asserts the theme attribute after any late stylesheet load.
applyAccessibilitySettings();

// Show a reconnect banner when the sync loop gives up permanently
window.addEventListener(VTT_EVENTS.SYNC_DEAD, () => {
  const app = document.getElementById('app');
  if (!app) return;
  showSyncDeadBanner(app, () => window.location.reload());
}, { once: true });

export class MatrixVTTClient {
  /** @param {{ matrixClientClass?: any }} [opts] */
  constructor({ matrixClientClass } = {}) {
    // DI seam threaded into ClientManager for tests. Production leaves
    // this undefined; ClientManager then uses the imported MatrixClient.
    this._matrixClientClass = matrixClientClass;
    this.clientManager = null;
    this.state = null;
    this.ui = null;
    this.chat = null;
    this.diceRoller = null;
  }

  /**
   * Initialize the full VTT stack for a specific room.
   * Called by app.html after successful login and room selection.
   */
  async initVTT(homeserver, accessToken, userId, roomId, forceWizard = false) {
    // Destroy any previous session completely - removes event listeners,
    // clears intervals, stops sync - before creating new instances.
    this.destroy();

    this.clientManager = new ClientManager({ matrixClientClass: this._matrixClientClass });
    this.clientManager.setCredentials(homeserver, accessToken, userId, roomId);
    await this.clientManager.init();

    const subscriptionManager = new SubscriptionManager();
    this.state = new StateManager(this.clientManager, subscriptionManager);
    await this.state.init();

    this.diceRoller = new DiceRoller(this.state);

    this.chat = new ChatIntegrator(this.clientManager, this.state, this.diceRoller);
    this.chat.init();

    this.ui = createUI(this.state, this.clientManager, this.chat);
    // forceWizard is passed by enterRoom when the user wasn't a member of
    // the room according to /joined_rooms. That signal alone is unreliable
    // (the response can be stale on network flakes and the wizard opening
    // on a plain page reload is a known UX footgun). Gate the forcing on
    // whether the server actually has a `com.vtt.settings` event - if it
    // does, the room has a live VTT campaign and we should load it
    // normally; if not, the room is empty and the wizard must seed it.
    if (forceWizard) {
      const hasSettings = await clientManagerHasSnapshot(this.clientManager);
      if (!hasSettings) {
        this.ui._forceWizard = true;
      }
    }
    this.ui.render();

    if (import.meta.env.DEV) _setupDevHelpers(this);

    logger.log('MatrixVTT', 'Initialized');
  }

  /**
   * Clean up when leaving a room.
   */
  destroy() {
    this.ui?.destroy();
    this.state?._clearAllState();
    this.state?.destroy();
    this.chat?.destroy();
    this.clientManager?.destroy();
    this.clientManager = this.state = this.ui = this.chat = this.diceRoller = window.ui = null;
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

// Production leaves __VTT_E2E_MATRIX_CLIENT_CLASS undefined; Playwright
// e2e specs set it via page.addInitScript before this module evaluates.
window.matrixVTTClient = new MatrixVTTClient({
  matrixClientClass: window.__VTT_E2E_MATRIX_CLIENT_CLASS,
});
