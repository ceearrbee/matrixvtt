/**
 * widgetReadAdapter.js - wrap a raw matrix-widget-toolkit API with a
 * `getMessages` method so widget-mode users see the same chat-history
 * seed standalone users get.
 *
 * Why this exists: matrix-widget-api has no equivalent of
 * `client.scrollback(room, limit)` - there is no /messages-style
 * backwards pagination intent. The closest read API,
 * `widgetApi.receiveRoomEvents`, returns every event of the given
 * type and msgtype that the widget has been granted visibility to in
 * one shot. So this adapter exposes a one-shot history seed: the
 * first call returns up to `limit` cached chat events, after which
 * `hasMoreHistory` flips to false and the LogPanel button hides.
 *
 * The wrapper proxies every other method straight through to the
 * underlying widgetApi so existing consumers (state event read/write,
 * observers, redact, OpenID) keep their existing call sites.
 *
 * Mirrors the return shape of MatrixApiAdapter.getMessages:
 *   { chunk: Array<{event_id, type, content, sender, origin_server_ts}>,
 *     end: string|null }
 */

import { logger } from '../utils/logger.js';
import { EVENT_TYPES, ROOM_MESSAGE_MSGTYPE_TEXT } from '../utils/constants.js';

/**
 * @param {object} widgetApi  The toolkit-backed WidgetApi instance.
 * @returns {object} A wrapper that exposes `getMessages` / `hasMoreHistory`
 *                   in addition to everything on widgetApi.
 */
export function createWidgetReadAdapter(widgetApi) {
  let exhausted = false;

  const overrides = {
    hasMoreHistory: true,
    hasMoreChatHistory: true,
    // Parity with MatrixApiAdapter.getChatMessages - this adapter's
    // getMessages is already filtered at source (receiveRoomEvents asks
    // for m.room.message only), so the chat path is the same fetch.
    async getChatMessages(limit = 100) {
      const res = await overrides.getMessages(limit);
      overrides.hasMoreChatHistory = overrides.hasMoreHistory;
      return res;
    },
    // The host client owns the sync loop in widget mode; if the widget
    // transport itself dies, the queue/rate-limit signals surface it.
    isSyncHealthy: () => true,
    async getMessages(limit = 100) {
      if (exhausted) return { chunk: [], end: null };
      try {
        const events = await widgetApi.receiveRoomEvents(EVENT_TYPES.ROOM_MESSAGE, {
          messageType: ROOM_MESSAGE_MSGTYPE_TEXT,
        });
        exhausted = true;
        overrides.hasMoreHistory = false;
        const list = Array.isArray(events) ? events : [];
        // receiveRoomEvents returns events in the widget's
        // visibility window. Honour the caller's limit but keep the
        // *most recent* limit events - older ones are less likely to
        // be useful in a long-running room.
        const chunk = list.slice(-limit).map((e) => ({
          event_id: e.event_id,
          type: e.type,
          content: e.content,
          sender: e.sender,
          origin_server_ts: e.origin_server_ts,
        }));
        return { chunk, end: null };
      } catch (err) {
        logger.warn('[widgetReadAdapter] receiveRoomEvents failed', err);
        exhausted = true;
        overrides.hasMoreHistory = false;
        return { chunk: [], end: null };
      }
    },
  };

  return new Proxy(overrides, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      const v = /** @type {any} */ (widgetApi)[prop];
      return typeof v === 'function' ? v.bind(widgetApi) : v;
    },
    has(target, prop) {
      return prop in target || prop in /** @type {any} */ (widgetApi);
    },
  });
}
