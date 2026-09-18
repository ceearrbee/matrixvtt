/**
 * Closing whichever drawer is open.
 *
 * Reports whether it did anything, so a keyboard handler can leave the
 * press alone when there was nothing to close rather than swallowing
 * an Escape something else wanted.
 */

import { openIconRailDrawerSignal } from '../state/ui-signals.js';

export function closeOpenDrawer() {
  if (!openIconRailDrawerSignal.value) return false;
  openIconRailDrawerSignal.value = null;
  return true;
}
