/**
 * theme.js - Theme restore, toggle, and map-help visibility helpers.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { themeSignal } from '../state/ui-signals.js';
import { setAccessibilitySetting, applyAccessibilitySettings } from './settings-helpers.js';

/**
 * Re-apply the persisted theme on shell (re)mount. The single source
 * of truth is the vtt:accessibility contract; letting the legacy
 * 'vtt-theme' key shadow it with a hard 'dark' default silently
 * reverts any theme picked in Settings on the next room entry. A
 * stored legacy value migrates once, then the key is removed.
 */
export function restoreTheme() {
  try {
    const legacy = localStorage.getItem(STORAGE_KEYS.THEME);
    if (legacy) {
      localStorage.removeItem(STORAGE_KEYS.THEME);
      setAccessibilitySetting('theme', legacy);
    }
  } catch (error) {
    logger.warn('UI', 'localStorage access blocked (Enhanced Tracking Protection):', error.message);
  }
  applyAccessibilitySettings();
}

const THEME_CYCLE = { auto: 'light', light: 'dark', dark: 'high-contrast', 'high-contrast': 'nondescript', nondescript: 'auto' };

export function toggleTheme(ui) {
  const currentTheme = themeSignal.value;
  const newTheme = THEME_CYCLE[currentTheme] ?? 'auto';

  setAccessibilitySetting('theme', newTheme);

  // Re-render map with new colors
  if (ui.mapRenderer) {
    ui.mapRenderer.updateThemeColors();
    ui.mapRenderer.render();
  }
}
