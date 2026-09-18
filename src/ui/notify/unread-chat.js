/**
 * Counts chat that arrived while the player was looking elsewhere,
 * and feeds the count to the tab title and the phone tab bar.
 *
 * "Looking elsewhere" is supplied by the caller rather than computed
 * here, because it means different things on a phone (the Chat pane
 * is not the visible one) and on a desktop (the tab is in the
 * background).
 */

import { signal } from '@preact/signals';
import { VTT_EVENTS } from '../../utils/constants.js';
import { setUnreadCount } from './tab-signal.js';

export const unreadChatSignal = signal(0);

export function startUnreadChat({ isChatVisible }) {
  const clearIfReading = () => {
    if (!isChatVisible()) return;
    unreadChatSignal.value = 0;
    setUnreadCount(0);
  };

  const onMessage = (e) => {
    // Backfill replays the whole history on load; none of it is news.
    if (e.detail?.historical) return;
    if (isChatVisible()) return;
    unreadChatSignal.value += 1;
    setUnreadCount(unreadChatSignal.value);
  };

  window.addEventListener(VTT_EVENTS.CHAT_MESSAGE, onMessage);
  document.addEventListener('visibilitychange', clearIfReading);
  window.addEventListener('focus', clearIfReading);

  return () => {
    window.removeEventListener(VTT_EVENTS.CHAT_MESSAGE, onMessage);
    document.removeEventListener('visibilitychange', clearIfReading);
    window.removeEventListener('focus', clearIfReading);
  };
}
