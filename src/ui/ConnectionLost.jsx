/**
 * ConnectionLost.jsx - full-screen recovery surface shown when
 * `initVTT` (or any other critical path) fails with a transport-level
 * error. See `src/utils/connection-error.js` for the classifier.
 *
 * Behaviour:
 *   - Visible for COUNTDOWN_SECS seconds with a live countdown.
 *   - Auto-reloads when the countdown hits 0.
 *   - "Cancel" button stops the timer (user can stay on the screen).
 *   - "Reload now" button reloads immediately.
 *
 * Reload-loop guard: stores a `consecutive` counter in sessionStorage.
 * If more than RELOAD_LIMIT reloads happen within RELOAD_WINDOW_MS,
 * the auto-reload is suppressed and the UI switches to manual-only
 * (matches the production audit's "no silent destructive loops" rule).
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const COUNTDOWN_SECS = 3;
const RELOAD_LIMIT = 2;
const RELOAD_WINDOW_MS = 60_000;
const COUNTER_KEY = 'vtt:connection-lost-reloads';

function readReloadCounter() {
  try {
    const raw = sessionStorage.getItem(COUNTER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const cutoff = Date.now() - RELOAD_WINDOW_MS;
    return Array.isArray(arr) ? arr.filter((t) => t >= cutoff) : [];
  } catch { return []; }
}
function recordReload() {
  try {
    const next = [...readReloadCounter(), Date.now()];
    sessionStorage.setItem(COUNTER_KEY, JSON.stringify(next));
  } catch { /* private mode */ }
}

/**
 * @param {{ errorMessage?: string, win?: Window }} props
 */
export function ConnectionLost({ errorMessage = '', win = window }) {
  const recentReloads = readReloadCounter();
  const inLoop = recentReloads.length >= RELOAD_LIMIT;

  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  const [cancelled, setCancelled] = useState(inLoop);

  useEffect(() => {
    if (cancelled) return;
    if (secsLeft <= 0) {
      recordReload();
      win.location.reload();
      return;
    }
    const t = win.setTimeout(() => setSecsLeft((n) => n - 1), 1000);
    return () => win.clearTimeout(t);
  }, [secsLeft, cancelled, win]);

  const reloadNow = () => {
    recordReload();
    win.location.reload();
  };

  return h('div', {
    role: 'alert',
    'aria-live': 'polite',
    class: 'connection-lost',
  }, [
    h('div', { class: 'connection-lost__card' }, [
      h('h2', { class: 'connection-lost__title' }, 'Connection lost'),
      h('p', { class: 'connection-lost__body' }, inLoop
        ? 'Couldn’t recover after several reload attempts. Check your network and try again.'
        : 'The app couldn’t finish loading. This usually means the network dropped briefly. Reloading should recover it.'),
      errorMessage && h('p', { class: 'connection-lost__detail' }, errorMessage),
      h('div', { class: 'connection-lost__actions' }, [
        h('button', {
          type: 'button',
          class: 'dbt btn-primary',
          onClick: reloadNow,
        }, 'Reload now'),
        !cancelled && !inLoop && h('button', {
          type: 'button',
          class: 'dbt',
          onClick: () => setCancelled(true),
        }, `Cancel (auto-reload in ${secsLeft}s)`),
      ]),
    ]),
  ]);
}
