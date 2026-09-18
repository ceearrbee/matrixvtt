/**
 * Telling a player the table is waiting on them.
 *
 * The initiative effect logged the turn to chat and announced it to a
 * polite live region, and the only visible "your turn" markers lived
 * inside the combat panel. A player reading chat on a phone, or with
 * the tab in the background, was told nothing at all.
 *
 * The decision is pure so it can be tested without a browser: the
 * effect supplies what it knows, this decides what fires.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NOTIFY_DEFAULTS, getNotifyPrefs, setNotifyPref, decideTurnNotice,
} from '../ui/notify/my-turn.js';

const prefs = (over = {}) => ({ ...NOTIFY_DEFAULTS, ...over });

beforeEach(() => localStorage.clear());

describe('decideTurnNotice', () => {
  it('does nothing when the turn is not mine', () => {
    const out = decideTurnNotice({ startedMyTurn: false, prefs: prefs({ desktop: true, sound: true }), hidden: true, permission: 'granted' });
    expect(out).toEqual({ toast: false, desktop: false, sound: false });
  });

  it('always shows an in-app toast on my turn', () => {
    const out = decideTurnNotice({ startedMyTurn: true, prefs: prefs(), hidden: false, permission: 'default' });
    expect(out.toast).toBe(true);
  });

  it('holds the desktop notification until the user opts in', () => {
    const out = decideTurnNotice({ startedMyTurn: true, prefs: prefs({ desktop: false }), hidden: true, permission: 'granted' });
    expect(out.desktop).toBe(false);
  });

  it('holds the desktop notification without permission', () => {
    const out = decideTurnNotice({ startedMyTurn: true, prefs: prefs({ desktop: true }), hidden: true, permission: 'denied' });
    expect(out.desktop).toBe(false);
  });

  it('does not interrupt a player who is already looking at the tab', () => {
    const out = decideTurnNotice({ startedMyTurn: true, prefs: prefs({ desktop: true }), hidden: false, permission: 'granted' });
    expect(out.desktop).toBe(false);
  });

  it('notifies an opted-in player whose tab is hidden', () => {
    const out = decideTurnNotice({ startedMyTurn: true, prefs: prefs({ desktop: true }), hidden: true, permission: 'granted' });
    expect(out.desktop).toBe(true);
  });

  it('plays the chime on my turn when opted in, tab visible or not', () => {
    expect(decideTurnNotice({ startedMyTurn: true, prefs: prefs({ sound: true }), hidden: false, permission: 'default' }).sound).toBe(true);
    expect(decideTurnNotice({ startedMyTurn: true, prefs: prefs({ sound: false }), hidden: true, permission: 'granted' }).sound).toBe(false);
  });
});

describe('notification preferences', () => {
  it('default to off, because sound and popups are interruptions', () => {
    expect(NOTIFY_DEFAULTS).toEqual({ desktop: false, sound: false });
  });

  it('round-trip per user', () => {
    setNotifyPref('@a:hs', 'desktop', true);
    expect(getNotifyPrefs('@a:hs').desktop).toBe(true);
  });

  it('do not leak between two users on one browser', () => {
    setNotifyPref('@a:hs', 'sound', true);
    expect(getNotifyPrefs('@b:hs').sound).toBe(false);
  });

  it('fall back to defaults for a signed-out reader', () => {
    expect(getNotifyPrefs(null)).toEqual(NOTIFY_DEFAULTS);
  });
});
