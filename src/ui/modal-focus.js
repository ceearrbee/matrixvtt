/**
 * Focus management shared by the imperative ModalFactory and the Preact
 * <Modal> component.
 */
import { createFocusTrap } from 'focus-trap';

export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab-cycle focus inside `element`, restoring focus to the previously-
 * focused element on cleanup. Backed by `focus-trap` so stacked modals
 * + edge-case tabbables (radio groups, contenteditable) are handled
 * correctly. Returns a disposer; safe to call repeatedly.
 */
export function trapFocusIn(element) {
  const trap = createFocusTrap(element, {
    // The caller drives initial focus itself - letting focus-trap also
    // try to focus an element races with that and ends up double-focusing
    // or stealing focus from the requested autofocus target.
    initialFocus: false,
    // Escape close + outside click are owned by the modal shell;
    // focus-trap only runs the Tab loop.
    escapeDeactivates: false,
    clickOutsideDeactivates: false,
    allowOutsideClick: true,
    returnFocusOnDeactivate: true,
    // Some test harnesses pass elements with no tabbables yet; falling
    // back to the container itself avoids the activate-time throw.
    fallbackFocus: element,
  });
  try { trap.activate(); } catch { /* no tabbables yet; deactivate is still safe */ }
  return () => { try { trap.deactivate(); } catch { /* idempotent */ } };
}
