
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
  // "View Sheet" from the map context menu selects the entity into the
  // sidebar, which is its canonical home; only item tokens, which have
  // no sidebar sheet, get a popup (see preview/preview-token.js).
  // Falls back to the legacy tab-switch path if previewToken isn't
  // wired yet (attached-method order during boot).
  ui.handleViewSheet = (event) => {
    const tokenId = event.detail.tokenId;
    if (typeof ui.previewToken === 'function') ui.previewToken(tokenId);
    else ui._selectTokenAndSwitchTab(tokenId);
  };
  ui.updateDiceResult = (rollData) => updateDiceResultFn(ui, rollData);
}
