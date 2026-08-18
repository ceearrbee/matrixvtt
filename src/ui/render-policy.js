/**
 * render-policy.js - initial render decision tree.
 * Mounts the Preact app, initialises the map renderer, wires
 * one-time global listeners, and decides whether to show the
 * setup wizard, player welcome, or onboarding tour on first render.
 */

import { mountApp } from './App.jsx';
import { maybeAutoStartTour } from './onboarding-tour.js';
import { _countResidualEntities } from './setup-tombstone.js';
import { probeRoomSnapshotState } from '../utils/room-snapshot-probe.js';
import { decideFirstRender } from './first-render-decision.js';
import {
  roomAlreadyVisited, stampRoomVisited, clearRoomVisited,
} from '../utils/room-visited.js';
import { logger } from '../utils/logger.js';

export function renderUI(ui) {
  const app = document.getElementById('app');
  if (!app) return;

  ui.restoreTheme();

  mountApp(app, ui);

  ui._syncDisplayName();

  if (!ui._welcomeShown) {
    ui._welcomeShown = true;
    requestAnimationFrame(async () => {
      const userId = ui.widgetManager?.userId ?? null;
      const roomId = ui.widgetManager?.roomId ?? null;

      // Persistent stamp: once a user has successfully entered a room
      // and renderUI took the non-wizard branch, the wizard is
      // suppressed on subsequent reloads. The upstream snapshot probe
      // is best-effort and trips on partial-sync timing; the stamp is
      // a defense-in-depth layer.
      const alreadyVisited = roomAlreadyVisited(userId, roomId);

      const noMap = !ui.state.map || Object.keys(ui.state.map).length === 0;
      const residual = _countResidualEntities(ui);

      // Server probe: even if local state hasn't finished hydrating
      // from the Yjs snapshot, the snapshot itself lives in /state.
      let snapshotState = /** @type {'present' | 'absent' | 'unknown'} */ ('unknown');
      if (noMap || ui._forceWizard) {
        const api = ui.widgetManager?.getApi?.();
        snapshotState = api ? await probeRoomSnapshotState(api) : 'unknown';
      }

      const { showWizard, staleStamp } = decideFirstRender({
        alreadyVisited,
        noMap,
        forceWizard: !!ui._forceWizard,
        residual,
        snapshotState,
      });
      if (staleStamp) {
        logger.warn('RenderPolicy',
          `stale room-visited stamp on a confirmed-empty room - clearing so the wizard can fire`,
        );
        clearRoomVisited(userId, roomId);
      }

      logger.log('RenderPolicy',
        `wizard decision: showWizard=${showWizard} alreadyVisited=${alreadyVisited} noMap=${noMap} forceWizard=${!!ui._forceWizard} residual=${residual} snapshotState=${snapshotState}`,
      );

      if (showWizard) {
        ui.showFirstTimeSetup();
      } else {
        // Tour first, welcome after: both are focus-stealing overlays
        // and firing together stacks them on first entry.
        maybeAutoStartTour({ ui, onAfterTour: () => ui.showPlayerWelcome?.() });
        // Mark this (user, room) as visited so subsequent reloads
        // bypass the wizard decision entirely.
        stampRoomVisited(userId, roomId);
      }
    });
  }
}
