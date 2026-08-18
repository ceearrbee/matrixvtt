/**
 * chat-composer-helpers.js - shared chat-input plumbing.
 *
 * Extracted from DiceBar.jsx so both the legacy DiceBar (still mounted
 * in the old shell) and the new chat-shell `Composer.jsx` reach for
 * the same primitives:
 *   - per-room sessionStorage draft restore / write-through
 *   - auto-grow with a fixed pixel cap (mirrors .chat-input--multiline
 *     `max-height: 12em`).
 *
 * Kept tiny and DOM-light so unit tests don't need a full ui harness.
 */

const DRAFT_PREFIX = 'vtt:chat-draft:';

// Auto-grow cap. Mirror of `max-height: 12em` on .chat-input--multiline.
// Kept as a constant rather than reading getComputedStyle each input so
// the auto-grow doesn't sample DOM state during render.
const CHAT_INPUT_MAX_PX = 168;

function draftKey(roomId) {
  return roomId ? `${DRAFT_PREFIX}${roomId}` : null;
}

export function readDraft(roomId) {
  const k = draftKey(roomId);
  if (!k) return '';
  try { return sessionStorage.getItem(k) || ''; } catch { return ''; }
}

export function writeDraft(roomId, value) {
  const k = draftKey(roomId);
  if (!k) return;
  try {
    if (value) sessionStorage.setItem(k, value);
    else sessionStorage.removeItem(k);
  } catch { /* private mode */ }
}

export function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, CHAT_INPUT_MAX_PX)}px`;
}
