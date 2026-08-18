/**
 * Lock body scroll while at least one modal is open. Refcounted via a data
 * attribute so nested modals don't fight over the inline style; the scrollbar
 * gutter is reserved with `padding-right` so the page behind the overlay
 * doesn't shift when scroll disappears.
 */
export function lockBodyScroll() {
  const body = document.body;
  const count = parseInt(body.dataset.modalLockCount || '0', 10);
  if (count === 0) {
    const sbWidth = window.innerWidth - body.clientWidth;
    body.dataset.modalPrevOverflow = body.style.overflow || '';
    body.dataset.modalPrevPaddingRight = body.style.paddingRight || '';
    body.style.overflow = 'hidden';
    if (sbWidth > 0) body.style.paddingRight = `${sbWidth}px`;
  }
  body.dataset.modalLockCount = String(count + 1);
}

export function unlockBodyScroll() {
  const body = document.body;
  const count = parseInt(body.dataset.modalLockCount || '0', 10);
  const next = Math.max(0, count - 1);
  body.dataset.modalLockCount = String(next);
  if (next === 0) restoreBodyScroll();
}

/**
 * Force the body scroll lock back to its unlocked baseline regardless of the
 * current refcount. Used when modals are torn down out-of-band (e.g.
 * `closeAllModals` ripping overlays out of the DOM without running each
 * modal's unmount cleanup), so the lock can't get stuck on.
 */
export function resetBodyScrollLock() {
  const body = document.body;
  if (!('modalLockCount' in body.dataset)) return;
  restoreBodyScroll();
}

function restoreBodyScroll() {
  const body = document.body;
  body.style.overflow = body.dataset.modalPrevOverflow || '';
  body.style.paddingRight = body.dataset.modalPrevPaddingRight || '';
  delete body.dataset.modalPrevOverflow;
  delete body.dataset.modalPrevPaddingRight;
  delete body.dataset.modalLockCount;
}
