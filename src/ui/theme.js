/**
 * theme.js - re-apply the persisted theme on shell (re)mount.
 *
 * Choosing a theme is the labelled select in Settings > Appearance; the
 * lower-left menu used to carry a second, blind cycler through the same
 * five values.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
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

