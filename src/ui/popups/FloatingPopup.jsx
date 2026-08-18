/**
 * FloatingPopup - popup primitive for the chat-shell revamp.
 *
 * One of the three panel states:
 *   closed  → not mounted
 *   popup   → this component, anchored above the composer
 *   docked  → DockSlot
 *
 * Semantics borrowed from rpglog (Prose Pals) `.floating-popup`:
 *   - ESC closes (unless pinned)
 *   - outside mousedown closes (unless pinned)
 *   - pin button toggles `pinned` so power users can keep dice / init
 *     open while typing
 *   - focus traps inside the popup while open; restores to opener on close
 *   - portals to <body> so stacking context is independent of the shell
 *
 * Reuses `trapFocusIn` from src/ui/modal-focus.js for tab-cycle behavior.
 */

import { h } from 'preact';
import { useEffect, useRef, useId } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { trapFocusIn } from '../modal-focus.js';
import { PinIcon } from '../icons/index.jsx';

/**
 * @param {{
 *   open: boolean,
 *   name: string,
 *   title: string,
 *   onClose: () => void,
 *   pinned?: boolean,
 *   onTogglePin?: () => void,
 *   size?: 'default' | 'wide' | 'full',
 *   children?: any,
 * }} props
 */
export function FloatingPopup({ open, name, title, onClose, pinned = false, onTogglePin, size, children }) {
  const popupRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = /** @type {HTMLElement|null} */ (document.activeElement);
    const releaseTrap = popupRef.current ? trapFocusIn(popupRef.current) : () => {};

    const onKey = (e) => {
      if (e.key === 'Escape' && !pinned) {
        e.stopPropagation();
        onClose();
      }
    };
    const onOutside = (e) => {
      if (pinned) return;
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
      releaseTrap();
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch { /* element gone; ignore */ }
      }
    };
  }, [open, pinned, onClose]);

  if (!open) return null;

  const popup = h('div', {
    ref: popupRef,
    class: 'floating-popup',
    role: 'dialog',
    'aria-labelledby': titleId,
    'aria-modal': 'false',
    'data-floating-popup': name,
    'data-pinned': pinned ? '' : null,
    'data-size': size || 'default',
  }, [
    h('div', { class: 'floating-popup__title', key: 'title' }, [
      h('span', { id: titleId, class: 'floating-popup__title-text', key: 't' }, title),
      h('div', { class: 'floating-popup__title-actions', key: 'actions' }, [
        onTogglePin
          ? h('button', {
              key: 'pin',
              type: 'button',
              class: 'floating-popup__pin',
              'data-popup-pin': '',
              'aria-pressed': pinned ? 'true' : 'false',
              'aria-label': pinned ? 'Unpin' : 'Pin open',
              title: pinned ? 'Unpin' : 'Keep open',
              onClick: onTogglePin,
            }, h(PinIcon, {}))
          : null,
        h('button', {
          key: 'close',
          type: 'button',
          class: 'floating-popup__close',
          'data-popup-close': '',
          'aria-label': 'Close',
          onClick: onClose,
        }, '×'),
      ]),
    ]),
    h('div', { class: 'floating-popup__body', key: 'body' }, children),
  ]);

  return createPortal(popup, document.body);
}
