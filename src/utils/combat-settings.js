/**
 * Combat automation preferences, stored per browser.
 *
 * Lives in utils rather than beside the panel that renders it because
 * a state writer reads `auto_reveal_fog` and the state layer must not
 * import from the UI layer.
 *
 * Every key here must be read somewhere outside this module and the
 * panel; `settingsHaveReaders.test.js` enforces it, because a setting
 * with no reader is a control that lies.
 */

import { STORAGE_KEYS } from './constants.js';
import { logger } from './logger.js';

export const COMBAT_DEFAULTS = {
  auto_announce_round:   true,
  // On, because the reveal ran unconditionally before this setting
  // gated it. Defaulting off would silently close the fog in rooms
  // that had been playing with it open.
  auto_reveal_fog:       true,
  default_vision_radius: 30,
};

export function getCombatSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMBAT_AUTOMATION) ?? '{}';
    return { ...COMBAT_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...COMBAT_DEFAULTS };
  }
}

export function setCombatSetting(key, value) {
  const settings = getCombatSettings();
  settings[key] = value;
  try {
    localStorage.setItem(STORAGE_KEYS.COMBAT_AUTOMATION, JSON.stringify(settings));
  } catch (e) {
    logger.warn('UI', 'Failed to save combat settings:', e.message);
  }
}
