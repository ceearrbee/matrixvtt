/**
 * Room upgrade / m.room.tombstone handling via MatrixApiAdapter._checkTombstone.
 *
 * Tests that _checkTombstone:
 *  - returns true/false correctly
 *  - stops the sync loop (_syncActive = false)
 *  - dispatches vtt:room-upgraded with the replacement room ID
 */

import { describe, it, expect, vi } from 'vitest';
import { MatrixApiAdapter } from '../client/MatrixApiAdapter.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

function makeAdapter() {
  const client = {
    getRoomState: vi.fn().mockResolvedValue([]),
    sync: vi.fn().mockImplementation(() => new Promise(() => {})),
  };
  return new MatrixApiAdapter(client, '!room:example.com');
}

function makeTombstoneEvent(replacementRoomId) {
  return { type: EVENT_TYPES.TOMBSTONE, state_key: '', content: { replacement_room: replacementRoomId } };
}

function collectEvents(type) {
  const events = [];
  const handler = (e) => events.push(e);
  window.addEventListener(type, handler);
  return { events, cleanup: () => window.removeEventListener(type, handler) };
}

describe('MatrixApiAdapter._checkTombstone', () => {
  it('returns false when state events contain no tombstone', () => {
    const adapter = makeAdapter();
    expect(adapter._checkTombstone([])).toBe(false);
    expect(adapter._checkTombstone([{ type: EVENT_TYPES.TOKEN, state_key: 'x', content: {} }])).toBe(false);
  });

  it('returns true when a tombstone event is present', () => {
    const adapter = makeAdapter();
    expect(adapter._checkTombstone([makeTombstoneEvent('!new:example.org')])).toBe(true);
  });

  it('sets _syncActive to false when tombstone found', () => {
    const adapter = makeAdapter();
    adapter._syncActive = true;
    adapter._checkTombstone([makeTombstoneEvent('!new:example.org')]);
    expect(adapter._syncActive).toBe(false);
  });

  it('dispatches vtt:room-upgraded with the replacement room ID', () => {
    const adapter = makeAdapter();
    const { events, cleanup } = collectEvents(VTT_EVENTS.ROOM_UPGRADED);
    adapter._checkTombstone([makeTombstoneEvent('!new:homeserver.org')]);
    cleanup();
    expect(events).toHaveLength(1);
    expect(events[0].detail.replacementRoomId).toBe('!new:homeserver.org');
  });

  it('dispatches vtt:room-upgraded with null when replacement_room is absent', () => {
    const adapter = makeAdapter();
    const { events, cleanup } = collectEvents(VTT_EVENTS.ROOM_UPGRADED);
    adapter._checkTombstone([{ type: EVENT_TYPES.TOMBSTONE, state_key: '', content: {} }]);
    cleanup();
    expect(events[0].detail.replacementRoomId).toBeNull();
  });

  it('does not modify _syncActive when no tombstone found', () => {
    const adapter = makeAdapter();
    adapter._syncActive = true;
    adapter._checkTombstone([{ type: EVENT_TYPES.TOKEN, state_key: '', content: {} }]);
    expect(adapter._syncActive).toBe(true);
  });
});
