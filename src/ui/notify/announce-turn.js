/**
 * Fires whatever the player asked for when their turn starts: an
 * in-app toast always, a system notification and a chime only on
 * their say-so.
 *
 * The seam between the pure decision and the browser APIs, so the
 * initiative effect calls one function and holds no policy.
 */

import { decideTurnNotice, getNotifyPrefs } from './my-turn.js';
import { notificationPermission, showTurnNotification, playTurnChime } from './desktop.js';

export function announceMyTurn(ui, name) {
  const userId = ui?.state?.widgetManager?.userId ?? ui?.widgetManager?.userId ?? null;
  const notice = decideTurnNotice({
    startedMyTurn: true,
    prefs: getNotifyPrefs(userId),
    hidden: typeof document !== 'undefined' && document.visibilityState !== 'visible',
    permission: notificationPermission(),
  });
  if (notice.toast) ui._toast?.('Your turn', 'info');
  if (notice.desktop) showTurnNotification(name);
  if (notice.sound) playTurnChime();
  return notice;
}
