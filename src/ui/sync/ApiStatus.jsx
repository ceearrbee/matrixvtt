
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { BUILD_VERSION } from '../../utils/constants.js';
import { queueCountSignal } from '../../state/ui-signals.js';

export function ApiStatus({ ui }) {
  // Subscribe to queue-count changes so the "Changes queued" row
  const queueCount = queueCountSignal.value;
  // tick is kept only for the rate-limited countdown which IS time-driven.
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const wm = ui.widgetManager;
  const now = Date.now();
  const rateLimitedUntil = wm?.rateLimitedUntil ?? 0;
  const isLimited = now < rateLimitedUntil;
  const secondsLeft = isLimited ? Math.ceil((rateLimitedUntil - now) / 1000) : 0;
  const lastRetryAfterMs = wm?.lastRetryAfterMs ?? null;
  const homeserver = wm?.homeserver ?? null;

  const caps = wm?.serverCapabilities ?? null;
  const roomVersion = caps?.['m.room_versions']?.default ?? null;

  const row = (label, value) => h('div', {
    style: 'display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;font-size:12px;'
  }, [
    h('span', { style: 'color:var(--color-text-tertiary);' }, label),
    h('span', null, value),
  ]);

  if (!wm) {
    return h('span', { style: 'color:var(--color-text-tertiary);font-size:12px;' }, 'Not connected');
  }

  return h('div', null, [
    row('MatrixVTT version', BUILD_VERSION),
    homeserver && row('Homeserver', homeserver),
    roomVersion && row('Server room version', roomVersion),
    row('API status', isLimited
      ? h('span', { style: 'color:var(--color-text-danger);font-weight:600;' }, `Rate limited - ${secondsLeft}s remaining`)
      : h('span', { style: 'color:var(--color-text-success);' }, 'OK')
    ),
    row('Server-reported wait', lastRetryAfterMs != null
      ? [
          `${Math.ceil(lastRetryAfterMs / 1000)}s `,
          h('span', { style: 'color:var(--color-text-tertiary);font-size:11px;' }, '(server-requested backoff)')
        ]
      : h('span', { style: 'color:var(--color-text-tertiary);' }, 'None recorded')
    ),
    row('Changes queued', queueCount > 0
      ? h('span', { style: 'color:var(--color-accent);' }, `${queueCount} pending`)
      : h('span', { style: 'color:var(--color-text-success);' }, '0')
    ),
  ]);
}
