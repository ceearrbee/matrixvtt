/**
 * popupsSignal - transient popup state for the legacy shell. The
 * chat-shell dock system (slots, presets, user overrides) was deleted
 * with the abandoned chat-shell root; only open/close/toggle remain.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  popupsSignal, openPopup, closePopup, togglePopup, isPopupOpen,
} from '../state/popup-signals.js';

beforeEach(() => {
  popupsSignal.value = { open: new Set() };
});

describe('popupsSignal - open / close / toggle', () => {
  it('starts empty', () => {
    expect(popupsSignal.value.open.size).toBe(0);
  });

  it('openPopup adds a name and assigns a new Set instance', () => {
    const before = popupsSignal.value.open;
    openPopup('ooc');
    expect(isPopupOpen('ooc')).toBe(true);
    // New Set reference so signal subscribers fire.
    expect(popupsSignal.value.open).not.toBe(before);
  });

  it('closePopup removes a name and assigns a new Set instance', () => {
    openPopup('ooc');
    const before = popupsSignal.value.open;
    closePopup('ooc');
    expect(isPopupOpen('ooc')).toBe(false);
    expect(popupsSignal.value.open).not.toBe(before);
  });

  it('togglePopup flips open state', () => {
    togglePopup('browse');
    expect(isPopupOpen('browse')).toBe(true);
    togglePopup('browse');
    expect(isPopupOpen('browse')).toBe(false);
  });

  it('supports multiple simultaneous popups', () => {
    openPopup('ooc');
    openPopup('browse');
    expect(isPopupOpen('ooc')).toBe(true);
    expect(isPopupOpen('browse')).toBe(true);
    closePopup('ooc');
    expect(isPopupOpen('browse')).toBe(true);
  });
});
