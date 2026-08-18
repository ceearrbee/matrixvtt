/**
 * MatrixApiAdapter - m.room.tombstone handling
 *
 * When a sync response contains a m.room.tombstone state event the adapter
 * must stop the sync loop and dispatch vtt:room-upgraded so the UI can
 * prompt the user to follow the room upgrade.
 *
 * Logic is in _checkTombstone(stateEvents) - tested directly to avoid
 * spinning up the infinite async sync loop.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MatrixApiAdapter } from '../client/MatrixApiAdapter.js';

function makeAdapter() {
  const client = {
    getRoomState: vi.fn().mockResolvedValue([]),
    sync: vi.fn(),
    getRoomMessages: vi.fn().mockResolvedValue({ chunk: [], end: null }),
  };
  const adapter = new MatrixApiAdapter(client, '!room:example.com');
  adapter._syncActive = true; // simulate running loop
  return adapter;
}

function collectEvents(name) {
  const events = [];
  const handler = e => events.push(e);
  window.addEventListener(name, handler);
  return { events, cleanup: () => window.removeEventListener(name, handler) };
}

const TOMBSTONE = {
  type: 'm.room.tombstone',
  state_key: '',
  content: { body: 'Room upgraded', replacement_room: '!new:example.com' },
  event_id: '$tomb1',
};

describe('MatrixApiAdapter - room tombstone', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('dispatches vtt:room-upgraded when tombstone event is present', () => {
    const adapter = makeAdapter();
    const upgraded = collectEvents('vtt:room-upgraded');

    adapter._checkTombstone([TOMBSTONE]);

    upgraded.cleanup();
    expect(upgraded.events.length).toBe(1);
  });

  it('includes replacementRoomId in the event detail', () => {
    const adapter = makeAdapter();
    const upgraded = collectEvents('vtt:room-upgraded');

    adapter._checkTombstone([TOMBSTONE]);

    upgraded.cleanup();
    expect(upgraded.events[0].detail.replacementRoomId).toBe('!new:example.com');
  });

  it('stops the sync loop after detecting tombstone', () => {
    const adapter = makeAdapter();
    const upgraded = collectEvents('vtt:room-upgraded');

    adapter._checkTombstone([TOMBSTONE]);

    upgraded.cleanup();
    expect(adapter._syncActive).toBe(false);
  });

  it('does nothing when no tombstone event is present', () => {
    const adapter = makeAdapter();
    const upgraded = collectEvents('vtt:room-upgraded');

    adapter._checkTombstone([
      { type: 'com.vtt.settings', state_key: '', content: { name: 'Test' }, event_id: '$s1' }
    ]);

    upgraded.cleanup();
    expect(upgraded.events.length).toBe(0);
    expect(adapter._syncActive).toBe(true);
  });

  it('handles empty state events array without error', () => {
    const adapter = makeAdapter();
    expect(() => adapter._checkTombstone([])).not.toThrow();
    expect(adapter._syncActive).toBe(true);
  });
});
