/**
 * event-handlers.js - Top-level event wiring.
 *
 * Global keyboard shortcuts now live in `useKeyboardShortcuts` (the
 * Preact hook called from `App.jsx`). Keeping two parallel bindings -
 * the legacy `setupKeyboardShortcuts` here and the hook - caused every
 * shortcut to fire twice per keypress, which broke the debug toggle
 * (two flips of `localStorage[vtt:debug]` in one tick → no net change).
 *
 * This module is now just the resize-handler entry point used by
 * `lifecycle-init.js`.
 */

/**
 * Setup top-level event handlers that aren't managed by components.
 */
export function setupEventHandlers(ui) {
  ui.setupResizeHandlers();
}
