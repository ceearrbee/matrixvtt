/**
 * Modal.jsx - Preact modal shell.
 *
 * Owns the overlay + dialog markup, focus trap, body-scroll lock, the
 * capture-phase Escape handler, and the unsaved-changes guard. The actual
 * teardown (DOM removal + focus restore) is done by the `onClose` disposer
 * the caller gets from `openModal`; this component only decides *when* to
 * call it.
 */
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { FOCUSABLE, trapFocusIn } from './modal-focus.js';
import { lockBodyScroll, unlockBodyScroll } from './modal-scroll-lock.js';
import { openModal } from './modal-host.js';

export function Modal({
  id,
  title,
  maxWidth = '600px',
  closeOnOverlay = true,
  closeOnEscape = true,
  autoFocusSelector = null,
  isDirty = null,
  onClose = () => {},
  children = null,
}) {
  const dialogRef = useRef(null);
  // Keep the latest props reachable from the mount-time Escape listener
  // without re-registering it on every render.
  const handlers = useRef({ isDirty, onClose });
  handlers.current = { isDirty, onClose };

  const requestClose = (guarded) => {
    const { isDirty: dirty, onClose: close } = handlers.current;
    if (guarded && dirty && dirty()) {
      openModal((discardClose) =>
        h(Modal, { id: `${id}-discard-confirm`, title: 'Discard changes?', maxWidth: '400px', onClose: discardClose }, [
          h('p', { style: 'margin-bottom: 20px;' }, 'You have unsaved changes. Discard them?'),
          h('div', { class: 'form-actions' }, [
            h('button', { type: 'button', class: 'dbt', onClick: discardClose }, 'Keep editing'),
            h('button', { type: 'button', class: 'dbt dbt--danger', onClick: () => { discardClose(); close?.(); } }, 'Discard'),
          ]),
        ]),
      );
      return;
    }
    close?.();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    lockBodyScroll();
    const releaseTrap = trapFocusIn(dialog);
    // One paint of latency lets the modal lay out before we focus, so the
    // screen reader announces the dialog rather than the trigger.
    const raf = requestAnimationFrame(() => {
      if (autoFocusSelector) dialog?.querySelector(autoFocusSelector)?.focus();
      else dialog?.querySelector(FOCUSABLE)?.focus();
    });
    let escHandler = null;
    if (closeOnEscape) {
      escHandler = (e) => {
        if (e.key !== 'Escape') return;
        if (!dialog?.isConnected) return;
        requestClose(true);
      };
      // Capture phase: forms that stopPropagation() on keydown must not
      // block Escape from dismissing the modal.
      document.addEventListener('keydown', escHandler, { capture: true });
    }
    return () => {
      cancelAnimationFrame(raf);
      if (escHandler) document.removeEventListener('keydown', escHandler, { capture: true });
      releaseTrap();
      unlockBodyScroll();
    };
  }, []);

  const titleId = `${id}-title`;
  const onRootClick = (e) => {
    // Delegated close: any [data-modal-close] inside the dialog tears down
    // without the dirty guard (an explicit user dismissal).
    const closer = e.target?.closest?.('[data-modal-close]');
    if (closer) { requestClose(false); return; }
    if (closeOnOverlay && e.target === e.currentTarget) requestClose(true);
  };

  return h('div', { id, class: 'modal-overlay', onClick: onRootClick },
    h('div', {
      ref: dialogRef,
      class: 'modal-content',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      style: `max-width: ${maxWidth}`,
    }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: titleId }, title),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: () => requestClose(false) }, '✕'),
      ]),
      h('div', { class: 'modal-body' }, children),
    ]),
  );
}
