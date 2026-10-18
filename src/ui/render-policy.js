/**
 * render-policy.js - initial render.
 * Mounts the Preact app and opens the setup wizard for a room the user
 * just created. Every other room opens straight to its chat; the
 * shell's NextSteps checklist offers setup from there.
 */

import { mountApp } from './App.jsx';
import { _countResidualEntities } from './setup-tombstone.js';
import { probeRoomSnapshotState } from '../utils/room-snapshot-probe.js';
import { decideFirstRender } from './first-render-decision.js';

export function renderUI(ui) {
  const app = document.getElementById('app');
  if (!app) return;

  ui.restoreTheme();

  mountApp(app, ui);

  ui._syncDisplayName();

  if (ui._welcomeShown || !ui._forceWizard) return;
  ui._welcomeShown = true;
  requestAnimationFrame(async () => {
    // The local Yjs bridges may not have hydrated yet, so the published
    // snapshot is checked on the server as well.
    const api = ui.widgetManager?.getApi?.();
    const snapshotState = api ? await probeRoomSnapshotState(api) : 'unknown';
    const showWizard = decideFirstRender({
      forceWizard: ui._forceWizard,
      residual: _countResidualEntities(ui),
      snapshotState,
    });
    if (showWizard) ui.showFirstTimeSetup();
  });
}
