/**
 * notifications.js - Toast messages and screen-reader announcements.
 *
 * Toasts now delegate to the `sonner` library (mounted lazily into a
 * dedicated container on first use). The `toast(ui, message, type)`
 * call surface is unchanged so the ~20 call sites elsewhere in the
 * codebase don't need to change.
 *
 * The screen-reader announcement helper stays separate: it powers
 * non-toast announcements (turn changes, attack rolls) into a
 * dedicated #vtt-sr-announcements live region that already exists
 * in the app shell.
 */

import { h, render } from 'preact';
import { Toaster, toast as sonnerToast } from 'sonner';
import { addNotification } from '../state/notification-history.js';

let _mounted = false;

function _ensureToasterMounted() {
  if (_mounted) return;
  _mounted = true;

  // Inject Sonner's stylesheet via a <link> rather than importing CSS
  // here so Vite doesn't pull it into every entry chunk that imports
  // notifications transitively. The href points at the package's own
  // copy; in production Vite re-emits it under /assets.
  const cssId = 'sonner-styles';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    // Bare-specifier resolution via the bundler.
    link.href = new URL('../../node_modules/sonner/dist/styles.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  let root = document.getElementById('sonner-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'sonner-root';
    document.body.appendChild(root);
  }
  render(
    h(Toaster, {
      // top-center keeps toasts clear of the right rail in Combat
      // mode. The earlier top-right position covered the actor rows
      // the user needs at the start of a turn.
      position: 'top-center',
      closeButton: true,
      duration: 4000,
      // Colors come from the .vtt-sonner rules in styles.css: sonner's
      // own theme prop only knows light/dark and can't track the
      // four-theme token system.
      toastOptions: { className: 'vtt-sonner' },
    }),
    root,
  );
}

/** Announce a message to screen-reader live region. */
export function announce(_ui, message) {
  const el = document.getElementById('vtt-sr-announcements');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

/**
 * Show a toast notification. Canonical levels are the four members of
 * `TOAST_LEVEL` (`info | success | warn | error`); legacy `'warning'`
 * is routed identically to `'warn'` for safety but no new caller
 * should use it (see `__tests__/toastLevel.test.js`). Errors are
 * sticky (no auto-dismiss) so a fast-flapping subscription error
 * doesn't hide before the user sees it. Sonner deduplicates same-(id)
 * toasts automatically - we use the message as a stable id so
 * identical errors collapse into one with a counter.
 *
 * @param {{ _announce?: (msg: string) => void } | null | undefined} ui
 * @param {string} message
 * @param {import('../utils/constants.js').ToastLevel} [type]
 */
export function toast(ui, message, type = 'error') {
  _ensureToasterMounted();
  const id = `${type}:${message}`;
  const opts = {
    id,
    duration: type === 'error' ? Infinity : 4000,
  };
  switch (type) {
    case 'error':   sonnerToast.error(message, opts); break;
    case 'warning':
    case 'warn':    sonnerToast.warning(message, opts); break;
    case 'success': sonnerToast.success(message, opts); break;
    case 'info':    sonnerToast.info(message, opts); break;
    default:        sonnerToast(message, opts);
  }
  addNotification({ level: type === 'warning' ? 'warn' : type, message });
  ui?._announce?.(message);
}
