/**
 * debug-bar.js - dev debug bar markup + storage / clipboard / reload
 * actions. Bound via the ui controller in wiring files.
 *
 * The bar is still rendered as an HTML-string sink into the
 * `#debug-bar-container` in `App.jsx`. A Preact component is a
 * straight port once we're ready to pull the periodic refresh
 * interval into a signal effect; for now this keeps the contract
 * the existing callers expect.
 */

import { STORAGE_KEYS } from '../../utils/constants.js';
import { debugModeSignal } from '../../state/ui-signals.js';

export function toggleDebugMode(ui) {
  const next = !ui._debugMode;
  try {
    if (next) localStorage.setItem(STORAGE_KEYS.DEBUG, '1');
    else localStorage.removeItem(STORAGE_KEYS.DEBUG);
  } catch {
    // ETP / private browsing - debug toggle is best-effort.
  }
  if (!next && ui._debugBarInterval) {
    clearInterval(ui._debugBarInterval);
    ui._debugBarInterval = null;
  }
  // Drive the signal so the App re-renders reactively. A bare
  // ui.render() does not: re-invoking the root render is a no-op when
  // no subscribed signal changed, which is why the bar silently
  // failed to appear.
  debugModeSignal.value = next;
}

// renderDebugBar / updateDebugBar lived here as imperative
// HTML-string + DOM-attach functions. Replaced by the Preact
// `DebugBar.jsx` component which subscribes to the relevant
// signals via @preact/signals.

export function copyDebugToken(ui) {
  const token = ui.widgetManager?.accessToken;
  if (!token) return;
  navigator.clipboard?.writeText(token)
    .then(() => ui._toast('Access token copied', 'info'))
    .catch(() => ui._toast(
      "Couldn't copy to clipboard. Your browser may block clipboard access on non-HTTPS pages - try reloading over https.",
      'error',
    ));
}

export function clearDebugStorage(ui) {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('vtt:') || key.startsWith('mvtt_')) && key !== STORAGE_KEYS.AUTH_SESSION) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  ui._toast(`Cleared ${toRemove.length} local keys. Reloading...`, 'info');
  setTimeout(() => window.location.reload(), 1000);
}

export function hardReload() {
  window.location.reload();
}
