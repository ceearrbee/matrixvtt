/**
 * Mock Widget API for testing
 *
 * Provides a mock implementation of @matrix-widget-toolkit/api's WidgetApiImpl
 */

import { vi } from 'vitest';

export function createMockWidgetApi(overrides = {}) {
  const mockApi = {
    // Widget parameters
    widgetParameters: {
      roomId: '!test:server',
      userId: '@test:server',
      ...overrides.widgetParameters
    },

    // State event methods
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$mock_event_id' }),
    receiveStateEvents: vi.fn().mockResolvedValue([]),

    // Observable for real-time state updates
    observeStateEvents: vi.fn().mockReturnValue({
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn()
      }),
      pipe: vi.fn().mockReturnThis()
    }),

    // Room event methods
    sendRoomEvent: vi.fn().mockResolvedValue({ event_id: '$mock_room_event' }),

    // Capabilities
    requestCapabilities: vi.fn().mockResolvedValue(undefined),

    // OpenID token
    requestOpenIDConnectToken: vi.fn().mockReturnValue({
      toPromise: vi.fn().mockResolvedValue({
        matrix_server_name: 'test.server',
        sub: 'test'
      })
    }),

    ...overrides
  };

  return mockApi;
}

let _eventSeq = 0;

export function createMockStateEvent(type, content, stateKey = '') {
  return {
    type,
    content,
    state_key: stateKey,
    event_id: `$mock_${++_eventSeq}`,
    sender: '@test:server',
    origin_server_ts: Date.now(),
    room_id: '!test:server'
  };
}
