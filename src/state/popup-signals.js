/**
 * popup-signals.js - transient popup state for the legacy shell.
 *
 * Owns the `open` set consumed by LegacyChatPopups: each name is a
 * floating popup (mode / ooc / browse / notifications / globalMenu).
 * There is no dock system (slots, presets, user overrides); popups
 * are transient only.
 */

import { signal } from '@preact/signals';

/** @typedef {{ open: Set<string> }} PopupsState */

export const popupsSignal = signal(/** @type {PopupsState} */ ({
  open: new Set(),
}));

function nextState(/** @type {(s: PopupsState) => void} */ mutate) {
  const next = { open: new Set(popupsSignal.value.open) };
  mutate(next);
  popupsSignal.value = next;
}

/** Open a panel as a floating popup. */
export function openPopup(name) {
  nextState((s) => { s.open.add(name); });
}

/** Close a floating popup. */
export function closePopup(name) {
  nextState((s) => { s.open.delete(name); });
}

/** Toggle a popup. */
export function togglePopup(name) {
  if (popupsSignal.value.open.has(name)) closePopup(name);
  else openPopup(name);
}

export function isPopupOpen(name) {
  return popupsSignal.value.open.has(name);
}
