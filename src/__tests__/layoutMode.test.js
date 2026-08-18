/**
 * layoutMode - per-user "text" vs "icon" chrome preference. Persisted in
 * user-scoped localStorage (a personal viewing choice, never synced to
 * the room), defaulting to 'text' so existing users see no change.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { layoutModeSignal } from '../state/ui-signals.js';
import { hydrateLayoutMode, setLayoutMode } from '../ui/ui-mode.js';
import { LAYOUT_MODES, STORAGE_KEYS } from '../utils/constants.js';

const USER = '@alex:example.org';

beforeEach(() => {
  localStorage.clear();
  layoutModeSignal.value = LAYOUT_MODES.TEXT;
});
afterEach(() => localStorage.clear());

describe('layoutMode', () => {
  it('defaults to text when nothing is stored', () => {
    hydrateLayoutMode(USER);
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.TEXT);
  });

  it('persists per-user and hydrates back', () => {
    setLayoutMode(USER, LAYOUT_MODES.ICON);
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.ICON);
    // Simulate reload: reset the signal, then hydrate for the same user.
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
    hydrateLayoutMode(USER);
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.ICON);
  });

  it('is scoped to the user (a different account starts at the default)', () => {
    setLayoutMode(USER, LAYOUT_MODES.ICON);
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
    hydrateLayoutMode('@other:example.org');
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.TEXT);
  });

  it('ignores invalid stored/requested values', () => {
    localStorage.setItem(`${STORAGE_KEYS.LAYOUT_MODE}::${USER}`, 'bogus');
    hydrateLayoutMode(USER);
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.TEXT);
    setLayoutMode(USER, 'nonsense');
    expect(layoutModeSignal.value).toBe(LAYOUT_MODES.TEXT);
  });
});
