/**
 * Cache parity between standalone (ClientManager) and widget
 * (WidgetManager → room-adapter) paths of canEditRoomState.
 *
 * Pre-fix the widget path had no cache; the wizard / GM-only UI calls
 * canEditRoomState in tight loops, so widget mode was hitting the
 * homeserver dozens of times where standalone hit it once and reused
 * the cached value for 30 seconds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canEditRoomState } from '../widget/room-adapter.js';

function makeWm({ powerLevel }) {
  return {
    widgetApi: {
      receiveStateEvents: vi.fn(async () => [{
        content: { users: { '@me:hs': powerLevel }, users_default: 0 },
      }]),
    },
    isStandalone: false,
    userId: '@me:hs',
    roomId: '!room:hs',
  };
}

beforeEach(() => {
  // Reset Date so the TTL window starts cleanly each test.
});

describe('widget canEditRoomState - cache parity', () => {
  it('caches a true result so a second call within 30s does not re-fetch', async () => {
    const wm = makeWm({ powerLevel: 100 });
    expect(await canEditRoomState(wm)).toBe(true);
    expect(await canEditRoomState(wm)).toBe(true);
    expect(wm.widgetApi.receiveStateEvents).toHaveBeenCalledTimes(1);
  });

  it('caches a false result the same way', async () => {
    const wm = makeWm({ powerLevel: 0 });
    expect(await canEditRoomState(wm)).toBe(false);
    expect(await canEditRoomState(wm)).toBe(false);
    expect(wm.widgetApi.receiveStateEvents).toHaveBeenCalledTimes(1);
  });

  it('expires after 30s and re-fetches', async () => {
    const wm = makeWm({ powerLevel: 100 });
    await canEditRoomState(wm);
    expect(wm.widgetApi.receiveStateEvents).toHaveBeenCalledTimes(1);

    // Move expiry into the past to force a refresh.
    wm._canEditCache.expiry = Date.now() - 1;
    await canEditRoomState(wm);
    expect(wm.widgetApi.receiveStateEvents).toHaveBeenCalledTimes(2);
  });
});
