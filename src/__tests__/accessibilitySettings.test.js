/**
 * Accessibility settings - user preferences for reduced motion, high contrast.
 *
 * getAccessibilitySettings() reads from localStorage.
 * setAccessibilitySetting(key, value) persists to localStorage and applies the
 * setting by adding/removing CSS classes on document.documentElement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessibilitySettings, setAccessibilitySetting, applyAccessibilitySettings } from '../ui/settings-helpers.js';
import { STORAGE_KEYS } from '../utils/constants.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
});

describe('getAccessibilitySettings', () => {
  it('returns defaults when nothing is stored', () => {
    const s = getAccessibilitySettings();
    expect(s.reduced_motion).toBe(false);
    expect(s.theme).toBe('auto');
  });

  it('reflects stored values', () => {
    localStorage.setItem(STORAGE_KEYS.ACCESSIBILITY, JSON.stringify({ reduced_motion: true }));
    const s = getAccessibilitySettings();
    expect(s.reduced_motion).toBe(true);
  });
});

describe('setAccessibilitySetting', () => {
  it('persists the value to localStorage', () => {
    setAccessibilitySetting('reduced_motion', true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY) ?? '{}');
    expect(stored.reduced_motion).toBe(true);
  });

  it('adds CSS class on document.documentElement when true', () => {
    setAccessibilitySetting('reduced_motion', true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('removes CSS class when false', () => {
    document.documentElement.classList.add('reduced-motion');
    setAccessibilitySetting('reduced_motion', false);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
  });

});

describe('legacy high_contrast migration', () => {
  it('promotes a stored high_contrast flag to the High Contrast theme once', () => {
    localStorage.setItem(STORAGE_KEYS.ACCESSIBILITY, JSON.stringify({ high_contrast: true, theme: 'auto' }));
    applyAccessibilitySettings();

    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY) ?? '{}');
    expect(stored.theme).toBe('high-contrast');
    expect('high_contrast' in stored).toBe(false);
  });

  it('an explicit stored theme wins over the legacy flag', () => {
    localStorage.setItem(STORAGE_KEYS.ACCESSIBILITY, JSON.stringify({ high_contrast: true, theme: 'dark' }));
    applyAccessibilitySettings();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY) ?? '{}');
    expect('high_contrast' in stored).toBe(false);
  });
});
