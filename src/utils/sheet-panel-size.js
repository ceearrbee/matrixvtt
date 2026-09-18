/**
 * sheet-panel-size.js - per-(user, room) stamp for the width of the
 * right companion.
 *
 * Mirrors `map-strip-size.js`, which is the only working resizer the
 * app had: same key shape, same read-time clamp so the cap follows the
 * current viewport rather than the one in force when the value was
 * saved.
 *
 * There is no collapsed sentinel. Hiding the rail is focus mode's job,
 * and a width of zero reachable by dragging would be a second way to
 * do it with no way back.
 */

import { STORAGE_KEY_PREFIXES } from './constants.js';

const PREFIX = STORAGE_KEY_PREFIXES.SHEET_PANEL;

/** Narrower than this and a character sheet cannot lay out its rows. */
const MIN_PX = 180;
const HARD_MAX_PX = 800;
const MAX_VW_RATIO = 0.5;

/** Matches the `--sheet-panel-width` the stylesheet has always shipped. */
export const DEFAULT_SHEET_WIDTH = 280;

/** @param {string|null|undefined} userId @param {string|null|undefined} roomId */
function key(userId, roomId) {
  if (!userId || !roomId) return null;
  return `${PREFIX}${userId}:${roomId}`;
}

function viewportCap() {
  try {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    const cap = Math.floor(w * MAX_VW_RATIO);
    return Math.min(HARD_MAX_PX, Math.max(MIN_PX, cap));
  } catch { return MIN_PX; }
}

/**
 * @param {number|null|undefined} px
 * @returns {number|null} null when the input is not a finite number
 */
export function clampSheetPanelWidth(px) {
  if (px == null || !Number.isFinite(px)) return null;
  const n = Math.round(px);
  if (n < MIN_PX) return MIN_PX;
  const cap = viewportCap();
  return n > cap ? cap : n;
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 * @returns {number|null}
 */
export function readSheetPanelWidth(userId, roomId) {
  const k = key(userId, roomId);
  if (!k) return null;
  try {
    const raw = window.localStorage.getItem(k);
    if (raw == null || raw === '') return null;
    return clampSheetPanelWidth(Number.parseInt(raw, 10));
  } catch { return null; }
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 * @param {number} px
 */
export function writeSheetPanelWidth(userId, roomId, px) {
  const k = key(userId, roomId);
  const clamped = clampSheetPanelWidth(px);
  if (!k || clamped == null) return;
  try { window.localStorage.setItem(k, String(clamped)); }
  catch { /* private mode, quota */ }
}
