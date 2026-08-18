import { TABS, ENTITY_TYPES } from '../utils/constants.js';
import { activeTabSignal, tabManuallyChosenSignal } from '../state/ui-signals.js';

export function switchTab(ui, tabName) {
  tabManuallyChosenSignal.value = true;
  // Read from the signal (the source of truth) rather than the
  // _currentTab cache so a desync can't silently drop the write.
  if (activeTabSignal.value === tabName) return;
  ui._currentTab = tabName;
  activeTabSignal.value = tabName;
}

/**
 * Select a token and switch to the character sheet or NPC tab.
 */
export function selectTokenAndSwitchTab(ui, tokenId) {
  ui.selectToken(tokenId);
  const token = ui.state.tokens.get(tokenId);
  if (!token) return;
  
  const tab = token.type === ENTITY_TYPES.NPC ? TABS.NPC : TABS.SHEET;
  ui.switchTab(tab);
}

export function selectToken(ui, tokenId) {
  ui.state.selectedToken = tokenId;
}

export function startTurnTimer(ui) {
  ui._turnStartMs = Date.now();
  if (ui._turnTimerInterval) clearInterval(ui._turnTimerInterval);
  ui._turnTimerInterval = setInterval(() => {
    const el = document.getElementById('turn-timer');
    if (!el) return;
    const elapsed = Math.floor((Date.now() - ui._turnStartMs) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

export function stopTurnTimer(ui) {
  if (ui._turnTimerInterval) clearInterval(ui._turnTimerInterval);
  ui._turnTimerInterval = null;
  ui._turnStartMs = null;
}
