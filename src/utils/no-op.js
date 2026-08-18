/**
 * No-op implementation for production builds
 */
export function initRemoteLogging() {}
export const WidgetApi = class {
  constructor() {}
  async start() { return Promise.resolve(); }
  async requestCapabilities() { return Promise.resolve([]); }
  async sendStateEvent() { return Promise.resolve({ event_id: '$mock' }); }
  async sendRoomEvent() { return Promise.resolve({ event_id: '$mock' }); }
  on() {}
  emit() {}
};
