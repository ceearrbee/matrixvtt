/**
 * map-controls-wiring.js - attaches thin map-control delegates onto a
 * UIController instance, split out of src/ui/ui-methods.js to keep
 * that module small.
 *
 * Every method here is a one-line forward to `ui.mapRenderer.*` or
 * `ui.state.*`. Nothing here owns state; the MapRenderer and
 * StateManager are the authorities, as per the architecture rule that
 * UI code asks for behaviour rather than re-deciding it locally
 * (docs/ARCHITECTURE.md).
 *
 * Tolerant of a missing `mapRenderer` - UI methods are wired before
 * the canvas mounts, so every call checks for it.
 */

import { closeAllModals } from '../utils/modal-helpers.js';
import { pendingPlacementSignal } from '../state/signals.js';

export function attachMapControls(ui) {
  ui.updateMapPanel = () => ui.mapRenderer?.render();

  ui.zoomIn = () => ui.mapRenderer?.zoomIn();
  ui.zoomOut = () => ui.mapRenderer?.zoomOut();

  ui.setDrawTool = (tool) => ui.mapRenderer?.setTool(tool);
  ui.setDrawColor = (c) => { if (ui.mapRenderer) ui.mapRenderer.drawColor = c; };
  ui.setDrawWidth = (w) => { if (ui.mapRenderer) ui.mapRenderer.drawWidth = Number(w) || 3; };

  ui.pingLocation = () => {
    if (!ui.mapRenderer) return;
    // Close any open modals so the next map click reaches the stage -
    // otherwise the modal backdrop swallows it and the ping never
    closeAllModals();
    ui.mapRenderer._pingMode = true;
  };
  ui.clearDrawings = () => ui.state.clearDrawings();

  // Scene-setup actions (toolbar Scene group). Placement and fog area
  // selection both consume the next map click / drag.
  ui.beginTokenPlacement = () => {
    if (!ui.mapRenderer) return;
    closeAllModals();
    pendingPlacementSignal.value = { kind: 'new-token' };
  };
  ui.revealFogArea = () => ui.mapRenderer?.startAreaSelection?.('reveal');
  ui.hideFogArea = () => ui.mapRenderer?.startAreaSelection?.('hide');
}
