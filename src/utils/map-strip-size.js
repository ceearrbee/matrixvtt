/**
 * map-strip-size.js - per-(user, room) localStorage stamp for the
 * conversation-first map-strip height.
 *
 * The map strip in the chat column is drag-resizable. A clamp keeps
 * the stored size within a sensible band:
 *   - 0 px      → collapsed (header still visible at chrome height)
 *   - 80 px     → minimum expanded height (collapsed-but-visible)
 *   - 60vh cap  → roughly half the screen, enforced at read-time using
 *                  window.innerHeight (read-time so the cap reflects
 *                  the current viewport, not the viewport at save)
 *
 * Stored representation is a plain integer (px). The collapse toggle
 * persists 0; the drag handle persists clamped px in [MIN_PX, viewport
 * cap].
 */

import { useStorageSubscription } from '../ui/hooks/use-storage.js';
import { STORAGE_KEY_PREFIXES } from './constants.js';

const PREFIX = STORAGE_KEY_PREFIXES.MAP_STRIP;
const MIN_PX = 80;
const MAX_VH_RATIO = 0.6;

/** @param {string|null|undefined} userId @param {string|null|undefined} roomId */
function key(userId, roomId) {
  if (!userId || !roomId) return null;
  return `${PREFIX}${userId}:${roomId}`;
}

function viewportCap() {
  try {
    const h = typeof window !== 'undefined' ? window.innerHeight : 0;
    return Math.max(MIN_PX, Math.floor(h * MAX_VH_RATIO));
  } catch { return MIN_PX; }
}

/**
 * Clamp `px` to the [0, viewport-cap] band. 0 is the collapsed
 * sentinel and bypasses the MIN_PX floor - anything between (0, MIN_PX)
 * snaps up to MIN_PX so the strip never lives in a half-visible state.
 *
 * @param {number|null|undefined} px
 * @returns {number|null}  null when the input isn't a finite number
 */
export function clampMapStripSize(px) {
  if (px == null || !Number.isFinite(px)) return null;
  const n = Math.round(px);
  if (n <= 0) return 0;
  const cap = viewportCap();
  if (n < MIN_PX) return MIN_PX;
  if (n > cap) return cap;
  return n;
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 * @returns {number|null}
 */
export function readMapStripSize(userId, roomId) {
  const k = key(userId, roomId);
  if (!k) return null;
  try {
    const raw = window.localStorage.getItem(k);
    if (raw == null || raw === '') return null;
    const n = Number.parseInt(raw, 10);
    return clampMapStripSize(n);
  } catch { return null; }
}

/**
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 * @param {number} px
 */
export function writeMapStripSize(userId, roomId, px) {
  const k = key(userId, roomId);
  const clamped = clampMapStripSize(px);
  if (!k || clamped == null) return;
  try { window.localStorage.setItem(k, String(clamped)); }
  catch { /* private mode, quota */ }
}

function parseStored(raw) {
  if (raw == null || raw === '') return null;
  const n = Number.parseInt(raw, 10);
  return clampMapStripSize(n);
}

function serializeStored(value) {
  return value == null ? '' : String(value);
}

/**
 * Subscribe to the per-room stamp. Returns [height, setHeight]. The
 * setter clamps before persisting so callers can pass a raw drag delta
 * without worrying about bounds.
 *
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} roomId
 */
export function useMapStripSize(userId, roomId) {
  const k = key(userId, roomId) ?? `${PREFIX}unbound`;
  const [stored, setStored] = useStorageSubscription(k, {
    parse: parseStored,
    serialize: serializeStored,
  });
  const setClamped = (next) => setStored(clampMapStripSize(next));
  return /** @type {[number|null, (next: number) => void]} */ ([stored, setClamped]);
}
