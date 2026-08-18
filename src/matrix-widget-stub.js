/**
 * Matrix Widget API Stub
 * Minimal local implementation to replace the CDN dependency
 * This provides just enough API surface for MatrixVTT to work
 */

import { logger } from './utils/logger.js';

class WidgetApi {
  constructor() {
    this.widgetId = null;
    this.capabilities = [];
    this.eventHandlers = new Map();
  }

  /**
   * Start the widget (connects to parent if in iframe)
   */
  async start() {
    if (window.parent !== window.self) {
      logger.log('Widget API', 'Running in iframe - attempting parent communication');
      // In a real implementation, this would set up postMessage handlers
      // For now, we just acknowledge we're in a widget context
      return Promise.resolve();
    } else {
      logger.log('Widget API', 'Not in iframe - standalone mode');
      return Promise.resolve();
    }
  }

  /**
   * Request capabilities from the Matrix client
   */
  async requestCapabilities(capabilities) {
    logger.log('Widget API', 'Requesting capabilities:', capabilities);
    this.capabilities = capabilities;

    // In a real implementation, this would negotiate with the Matrix client
    // For now, we just grant all requested capabilities
    return Promise.resolve(capabilities);
  }

  /**
   * Send a state event to the Matrix room
   */
  async sendStateEvent(eventType, stateKey, content) {
    logger.log('Widget API', `sendStateEvent: ${eventType}#${stateKey}`, content);

    // In a real implementation, this would postMessage to the parent
    // For standalone mode, we just log it
    return Promise.resolve({
      event_id: `$local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  /**
   * Send a timeline event to the Matrix room
   */
  async sendRoomEvent(eventType, content) {
    logger.log('Widget API', `sendRoomEvent: ${eventType}`, content);

    return Promise.resolve({
      event_id: `$local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  /**
   * Send a text message to the Matrix room
   */
  async sendTextMessage(text, msgtype = 'm.text') {
    logger.log('Widget API', `sendTextMessage:`, text);

    return this.sendRoomEvent('m.room.message', {
      msgtype: msgtype,
      body: text
    });
  }

  /**
   * Listen for timeline events (simulated in standalone mode)
   */
  listenForTimelineEvents() {
    logger.log('Widget API', 'Listening for timeline events');

    // In a real widget, this would set up listeners for m.room.message events
    // For standalone mode, we simulate with a test message after 5 seconds
    if (window.parent === window.self) {
      setTimeout(() => {
        this.emit('timeline', {
          type: 'm.room.message',
          sender: '@testuser:matrix.org',
          content: {
            msgtype: 'm.text',
            body: '/roll 1d20+5'
          }
        });
      }, 5000);
    }
  }

  /**
   * Read state events from the Matrix room
   */
  async readStateEvents(eventType, stateKey = undefined) {
    logger.log('Widget API', `readStateEvents: ${eventType}#${stateKey || '*'}`);

    // In standalone mode, return empty array
    // In a real widget, this would fetch from the Matrix client
    return Promise.resolve([]);
  }

  /**
   * Register an event handler
   */
  on(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`handler must be a function, got ${typeof handler}`);
    }
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Emit an event to registered handlers
   */
  emit(eventType, data) {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }
}

// Export for module usage and also attach to window for compatibility
export { WidgetApi };

if (typeof window !== 'undefined') {
  window.mxwidgets = window.mxwidgets || {};
  window.mxwidgets.WidgetApi = WidgetApi;
}
