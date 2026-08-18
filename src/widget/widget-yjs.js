/**
 * Widget-mode Yjs wiring: runs YjsMatrixTransport over the widget API.
 *
 * The transport was written against MatrixClient; the shim below maps
 * the surface it uses (status, sendVTTEvent, onStatusUpdate) onto the
 * WidgetManager, wrapping sends in retryOnRateLimit for parity with
 * standalone mode. The widget transport is always "connected" - the
 * host client owns the sync loop.
 */

import { YjsMatrixTransport } from '../client/YjsMatrixTransport.js';
import { YJS_EVENT_TYPES } from '../utils/constants.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';
import { logger } from '../utils/logger.js';

export function attachWidgetYjs(wm, yjsManager) {
  if (!yjsManager || wm._yjsTransport) return null;

  const clientShim = {
    status: 'connected',
    userId: wm.userId,
    onStatusUpdate: () => () => {},
    sendVTTEvent: (_roomId, type, _stateKey, content) =>
      retryOnRateLimit(() => wm.sendRoomEvent(type, content)),
  };

  const transport = new YjsMatrixTransport(
    /** @type {any} */ (clientShim), yjsManager, wm.roomId
  );

  const subscriptions = [];
  for (const type of [YJS_EVENT_TYPES.UPDATE, YJS_EVENT_TYPES.SYNC_VECTOR]) {
    const sub = wm.widgetApi.observeRoomEvents(type).subscribe({
      next: (event) => transport.handleIncomingEvent(event),
      error: (err) => logger.warn('WidgetYjs', `${type} observable failed`, err?.message || err),
    });
    subscriptions.push(sub);
  }

  const baseDestroy = transport.destroy.bind(transport);
  transport.destroy = () => {
    for (const sub of subscriptions) sub.unsubscribe?.();
    baseDestroy();
    wm._yjsTransport = null;
  };

  wm._yjsTransport = transport;
  return transport;
}
