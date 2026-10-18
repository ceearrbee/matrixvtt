/**
 * The shell learns the room's access once at start-up, so the notice and
 * the header can say whether the room is public.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshRoomAccess } from '../state/lifecycle.js';
import { roomAccessSignal } from '../state/signals.js';

beforeEach(() => {
  roomAccessSignal.value = { encrypted: false, joinRule: null };
});

describe('refreshRoomAccess', () => {
  it('publishes the room access from the room manager', async () => {
    const sm = { widgetManager: { getRoomAccess: vi.fn().mockResolvedValue({ encrypted: false, joinRule: 'public' }) } };
    await refreshRoomAccess(sm);
    expect(roomAccessSignal.value).toEqual({ encrypted: false, joinRule: 'public' });
  });

  it('keeps the unknown default when the read fails', async () => {
    const sm = { widgetManager: { getRoomAccess: vi.fn().mockRejectedValue(new Error('offline')) } };
    await refreshRoomAccess(sm);
    expect(roomAccessSignal.value).toEqual({ encrypted: false, joinRule: null });
  });
});
