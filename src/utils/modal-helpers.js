/**
 * modal-helpers.js - small shared helpers for the modal overlay convention.
 */

import { resetBodyScrollLock } from '../ui/modal-scroll-lock.js';
import { closeAllOpenModals } from '../ui/modal-host.js';

/**
 * Tear down every open modal.
 *
 * Used when entering a one-shot map mode (item drop, set facing, ping)
 * from inside an open modal. Without this, the next click intended for
 * the Konva stage lands on the modal backdrop, dismisses the modal,
 * and never reaches the mode handler - placement / facing / ping
 * silently fails.
 *
 * `openModal`-based modals are closed through their own disposers (so their
 * container, focus trap, and Escape listener are cleaned up, not just the
 * overlay). Legacy hand-rolled overlays (EntityForm / MapsPanel / Settings
 * build their own `.modal-overlay`) are then removed directly, and the
 * refcounted scroll lock is reset so it can't stick on.
 */
export function closeAllModals() {
  if (typeof document === 'undefined') return;
  closeAllOpenModals();
  for (const overlay of document.querySelectorAll('.modal-overlay')) {
    overlay.remove();
  }
  resetBodyScrollLock();
}
