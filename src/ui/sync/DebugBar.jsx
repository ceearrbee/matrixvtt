
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { logger } from '../../utils/logger.js';

export function DebugBar({ ui }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const wm = ui.widgetManager;
  const hs = wm?.homeserver ?? '';
  const uid = wm?.userId ?? '';
  const rid = wm?.roomId ?? 'No Room';
  const mid = ui.state.activeMapId ?? 'No Map';
  const token = wm?.accessToken ?? '';
  const masked = token.length > 8 ? `…${token.slice(-8)}` : (token || 'N/A');

  const errors = logger.getErrorCount();

  return h('div', { class: 'debug-bar', role: 'status', 'aria-label': 'Debug info' }, [
    h('div', { class: 'debug-bar__section' }, [
      h('span', { class: 'debug-bar__label' }, 'DEBUG'),
      h('span', { title: `Homeserver: ${hs}` }, hs),
      h('span', { title: `User ID: ${uid}` }, uid),
    ]),
    h('div', { class: 'debug-bar__section' }, [
      h('span', { title: 'Room ID' }, ['Room: ', h('code', null, rid)]),
      h('span', { title: 'Active Map ID' }, ['Map: ', h('code', null, mid)]),
    ]),
    h('div', { class: 'debug-bar__section' }, [
      h('span', {
        style: errors > 0 ? 'color:var(--color-text-danger);font-weight:bold;' : '',
        title: `${errors} errors`
      }, ['Errors: ', h('b', null, errors)]),
    ]),
    h('div', { class: 'debug-bar__actions' }, [
      h('span', { class: 'debug-bar__token' }, [
        'Token: ', h('code', null, masked),
        h('button', { class: 'dbt dbt--sm', id: 'debug-copy-token', title: 'Copy debug token', 'aria-label': 'Copy debug token', onClick: () => ui._copyDebugToken() }, '📋'),
      ]),
      h('button', { class: 'dbt dbt--sm', id: 'debug-clear-storage', title: 'Clear cache', 'aria-label': 'Clear cache', onClick: () => ui._clearDebugStorage() }, '🧹'),
      h('button', { class: 'dbt dbt--sm', id: 'debug-reload', title: 'Reload', 'aria-label': 'Reload', onClick: () => ui._hardReload() }, '🔄'),
    ]),
  ]);
}
