
import {
  handleDiceRollResult as handleDiceRollResultFn,
  handleDamage as handleDamageFn,
  handleHeal as handleHealFn,
  updateDiceResult as updateDiceResultFn,
} from './state-updater.js';

export function attachEventHandlers(ui) {
  ui.handleDiceRollResult = (event) => handleDiceRollResultFn(ui, event);
  ui.handleDamage = (event) => handleDamageFn(ui, event);
  ui.handleHeal = (event) => handleHealFn(ui, event);
  // "View Sheet" from the map context menu opens the read-only preview
  // popup so the user keeps their current tab context. Falls back to
  // the legacy tab-switch path if previewToken isn't wired yet (e.g.
  // attached-method order during boot).
  ui.handleViewSheet = (event) => {
    const tokenId = event.detail.tokenId;
    if (typeof ui.previewToken === 'function') ui.previewToken(tokenId);
    else ui._selectTokenAndSwitchTab(tokenId);
  };
  ui.updateDiceResult = (rollData) => updateDiceResultFn(ui, rollData);
}
