/**
 * Deciding what fires when the table starts waiting on this player.
 *
 * The decision is pure: the caller supplies the tab's visibility, the
 * notification permission and the user's preferences, and this returns
 * what to do. Browser effects live in `desktop.js`.
 *
 * Preferences are per user because two accounts sharing a browser must
 * not inherit each other's interruptions.
 */

import { STORAGE_KEYS } from '../../utils/constants.js';
import { readUserScoped, writeUserScoped } from '../../utils/user-storage.js';

export const NOTIFY_DEFAULTS = { desktop: false, sound: false };

export function getNotifyPrefs(userId) {
  try {
    const raw = readUserScoped(STORAGE_KEYS.TURN_NOTIFY, userId);
    return { ...NOTIFY_DEFAULTS, ...JSON.parse(raw ?? '{}') };
  } catch {
    return { ...NOTIFY_DEFAULTS };
  }
}

export function setNotifyPref(userId, key, value) {
  const next = { ...getNotifyPrefs(userId), [key]: value };
  writeUserScoped(STORAGE_KEYS.TURN_NOTIFY, userId, JSON.stringify(next));
}

/**
 * @param {{ startedMyTurn: boolean, prefs: { desktop: boolean, sound: boolean },
 *           hidden: boolean, permission: string }} input
 */
export function decideTurnNotice({ startedMyTurn, prefs, hidden, permission }) {
  if (!startedMyTurn) return { toast: false, desktop: false, sound: false };
  return {
    toast: true,
    // A popup over a tab the player is already reading is noise; the
    // toast and the turn marker have them covered there.
    desktop: !!prefs.desktop && permission === 'granted' && !!hidden,
    sound: !!prefs.sound,
  };
}
