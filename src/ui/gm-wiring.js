/**
 * gm-wiring.js - GM-only operations attached to the ui controller.
 * Extracted from `ui-methods.js`. Thin forwards to gm-ops.js and the
 * delete-session entry in settings-panel.js.
 */

import {
  applyLongRest as applyLongRestFn,
  adjustXP as adjustXPFn,
  toggleFog as toggleFogFn,
  revealAllFog as revealAllFogFn,
  hideAllFog as hideAllFogFn,
  healAll as healAllFn,
  clearAllConditions as clearAllConditionsFn,
  adjustHP as adjustHPFn,
  adjustTokenHP as adjustTokenHPFn,
  setHP as setHPFn,
} from './gm-ops.js';
import { deleteSession as deleteSessionFn } from './gm/session-ops.js';

export function attachGMMethods(ui) {
  ui.applyLongRest = () => applyLongRestFn(ui);
  ui.adjustXP = (id, amt) => adjustXPFn(ui, id, amt);
  ui.toggleFog = () => toggleFogFn(ui);
  ui.revealAllFog = () => revealAllFogFn(ui);
  ui.hideAllFog = () => hideAllFogFn(ui);
  ui.healAll = () => healAllFn(ui);
  ui.clearAllConditions = () => clearAllConditionsFn(ui);
  ui.setHP = (id, val, type) => setHPFn(ui, id, val, type);
  ui.adjustHP = (id, amt, type) => adjustHPFn(ui, id, amt, type);
  ui.adjustTokenHP = (tokenId, amt) => adjustTokenHPFn(ui, tokenId, amt);
  ui.deleteSession = () => deleteSessionFn(ui);
  ui.submitMapForm = async (modal) => {
    const m = await import('./MapsPanel.jsx');
    return m.submitMapForm(ui, modal);
  };
}
