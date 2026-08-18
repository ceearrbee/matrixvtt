/**
 * NotificationLog.jsx - body for the `notifications` popup.
 *
 * Lists the session's toast history (newest first) from
 * notification-history.js. Opening the panel marks everything read,
 * which clears the unread badge on the lower-left ☰. Level is shown by
 * icon + text (never colour alone) per the a11y rules.
 */

import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import {
  notificationHistorySignal, markAllRead, clearNotifications,
} from '../state/notification-history.js';

const LEVEL_ICON = { info: 'ℹ️', success: '✓', warn: '⚠️', error: '✕' };
const LEVEL_WORD = { info: 'Info', success: 'Success', warn: 'Warning', error: 'Error' };

function relTime(ts, now) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function NotificationLog() {
  const list = notificationHistorySignal.value;

  useEffect(() => { markAllRead(); }, []);

  const now = Date.now();
  return h('div', { class: 'notification-log' }, [
    h('div', { class: 'notification-log__head', key: 'head' }, [
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        disabled: list.length === 0,
        onClick: () => clearNotifications(),
      }, 'Clear all'),
    ]),
    list.length === 0
      ? h('p', { class: 'notification-log__empty', key: 'empty' }, 'No notifications yet.')
      : h('ul', { class: 'notification-log__list', key: 'list' },
          list.map((e) => h('li', {
            key: e.id,
            class: `notification-log__item notification-log__item--${e.level}`,
          }, [
            h('span', { class: 'notification-log__icon', 'aria-hidden': 'true' }, LEVEL_ICON[e.level] || '•'),
            h('span', { class: 'notification-log__level' }, `${LEVEL_WORD[e.level] || e.level}: `),
            h('span', { class: 'notification-log__msg' }, e.message),
            h('span', { class: 'notification-log__time' }, relTime(e.ts, now)),
          ])),
        ),
  ]);
}
