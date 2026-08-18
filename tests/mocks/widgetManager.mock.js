/**
 * Mock Widget Manager for testing
 *
 * Provides a mock implementation of WidgetManager
 */

import { vi } from 'vitest';
import { createMockWidgetApi } from './widgetApi.mock.js';

export function createMockWidgetManager(overrides = {}) {
  const mockApi = createMockWidgetApi();

  const mockWidgetManager = {
    userId: '@test:server',
    roomId: '!test:server',
    isStandalone: false,
    widgetApi: mockApi,

    // Methods
    init: vi.fn().mockResolvedValue(undefined),
    getApi: vi.fn().mockReturnValue(mockApi),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$mock_event_id' }),
    sendRoomEvent: vi.fn().mockResolvedValue({ event_id: '$mock_room_event' }),
    isGM: vi.fn().mockReturnValue(false),
    getRateLimitWait: vi.fn().mockReturnValue(0),
    roomIdsSupported: null,
    setRoomIdsSupported: vi.fn(),

    ...overrides
  };

  return mockWidgetManager;
}

export function createGMWidgetManager() {
  return createMockWidgetManager({
    isGM: vi.fn().mockReturnValue(true)
  });
}

export function createPlayerWidgetManager(userId = '@player:server') {
  return createMockWidgetManager({
    userId,
    isGM: vi.fn().mockReturnValue(false)
  });
}
