/**
 * settings-helpers.js - Combat automation and accessibility preference management.
 */

import { STORAGE_KEYS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { themeSignal } from '../state/ui-signals.js';

function _get(key, defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  } catch { return { ...defaults }; }
}

function _set(key, settings) {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) { logger.warn('UI', `Failed to save settings to ${key}:`, e.message); }
}

const CA_KEY = STORAGE_KEYS.COMBAT_AUTOMATION;
const CA_DEFAULTS = {
  auto_advance_on_death:    false,
  auto_announce_round:      true,
  auto_roll_npc_initiative: false,
  auto_reveal_fog:          false,
  default_vision_radius:    30,
};

export const getCombatSettings = () => _get(CA_KEY, CA_DEFAULTS);

export function setCombatSetting(key, value) {
  const s = getCombatSettings();
  s[key] = value;
  _set(CA_KEY, s);
}

const ACC_KEY = STORAGE_KEYS.ACCESSIBILITY;
const ACC_DEFAULTS = { reduced_motion: false, theme: 'auto' };
const ACC_CLASSES  = { reduced_motion: 'reduced-motion' };
const VALID_THEMES = ['auto', 'dark', 'light', 'high-contrast', 'nondescript'];

export const getAccessibilitySettings = () => _get(ACC_KEY, ACC_DEFAULTS);

function _applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else if (VALID_THEMES.includes(theme)) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  // Mirror onto the signal so reactive consumers (GlobalMenu label,
  // theme tooltip) re-render regardless of which surface set the theme.
  themeSignal.value = theme;
}

export function setAccessibilitySetting(key, value) {
  const s = getAccessibilitySettings();
  s[key] = value;
  _set(ACC_KEY, s);
  if (key === 'theme') _applyTheme(value);
  else {
    const cls = ACC_CLASSES[key];
    if (cls) document.documentElement.classList.toggle(cls, value);
  }
  // Notify listeners (MapRenderer subscribes for stage colour rebuilds).
  window.dispatchEvent(new CustomEvent('vtt:theme-change', { detail: { key, value } }));
}

export function applyAccessibilitySettings() {
  const s = getAccessibilitySettings();
  // Legacy migration: the separate high-contrast checkbox is gone (the
  // theme select owns it); a stored flag promotes to the theme once.
  if ('high_contrast' in s) {
    if (s.high_contrast === true && (!s.theme || s.theme === 'auto')) s.theme = 'high-contrast';
    delete s.high_contrast;
    _set(ACC_KEY, s);
    document.documentElement.classList.remove('high-contrast');
  }
  Object.entries(s).forEach(([k, v]) => {
    if (k === 'theme') { _applyTheme(v); return; }
    const cls = ACC_CLASSES[k];
    if (cls) document.documentElement.classList.toggle(cls, v);
  });
}
