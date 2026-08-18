import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { MatrixApiAdapter } from '../MatrixApiAdapter.js';
import { EVENT_TYPES, VTT_EVENTS } from '../../utils/constants.js';

describe('MatrixApiAdapter (Refactored)', () => {
  let matrixClient;
  let adapter;
  let mockSdk;
  const roomId = '!room:id';

  beforeEach(() => {
    mockSdk = {
      on: vi.fn(),
      getRoom: vi.fn(),
      roomState: vi.fn(),
    };
    matrixClient = { sdk: mockSdk };
    adapter = new MatrixApiAdapter(matrixClient, roomId);
  });

  it('maps SDK RoomState.events to RxJS subjects', () => {
    const type = EVENT_TYPES.TOKEN;
    const subject = adapter.observeStateEvents(type);
    const results = [];
    subject.subscribe(e => results.push(e));

    const stateCallback = mockSdk.on.mock.calls.find(call => call[0] === 'RoomState.events')[1];
    
    const mockEvent = {
      getType: () => type,
      getStateKey: () => 'token1',
      getContent: () => ({ x: 10 }),
      getSender: () => '@alice:m.org',
      getId: () => '$event1',
      getTs: () => 123456,
      getRoomId: () => roomId,
    };

    stateCallback(mockEvent);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type,
      state_key: 'token1',
      content: { x: 10 },
      event_id: '$event1',
    });
  });

  it('dispatches matrix:timeline-event for non-state events', () => {
    const timelineCallback = mockSdk.on.mock.calls.find(call => call[0] === 'Room.timeline')[1];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const mockEvent = {
      isState: () => false,
      getType: () => 'm.room.message',
      getStateKey: () => undefined,
      getContent: () => ({ body: 'hello' }),
      getSender: () => '@alice:m.org',
      getId: () => '$msg1',
      getTs: () => 123456,
      getRoomId: () => roomId,
    };

    const mockRoom = { roomId };
    timelineCallback(mockEvent, mockRoom, false);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.find(call => call[0].type === 'matrix:timeline-event')[0];
    expect(event.detail).toMatchObject({
      type: 'm.room.message',
      content: { body: 'hello' },
      _historical: true, // initial sync not done yet
    });
  });

  it('detects room tombstones and dispatches vtt:room-upgraded', () => {
    const stateCallback = mockSdk.on.mock.calls.find(call => call[0] === 'RoomState.events')[1];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const mockEvent = {
      getType: () => 'm.room.tombstone',
      getStateKey: () => '',
      getContent: () => ({ replacement_room: '!newroom:id' }),
      getSender: () => '@gm:m.org',
      getId: () => '$tomb1',
      getTs: () => 123456,
      getRoomId: () => roomId,
    };

    stateCallback(mockEvent);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.find(call => call[0].type === VTT_EVENTS.ROOM_UPGRADED)[0];
    expect(event.detail.replacementRoomId).toBe('!newroom:id');
  });

  describe('receiveStateEvents', () => {
    it('uses SDK room cache if initial sync is done', async () => {
      // Mark initial sync done
      const syncCallback = mockSdk.on.mock.calls.find(call => call[0] === 'sync')[1];
      syncCallback('PREPARED');

      const mockEvent = {
        getType: () => EVENT_TYPES.SETTINGS,
        getStateKey: () => '',
        getContent: () => ({ name: 'Test' }),
        getSender: () => '@gm:m.org',
        getId: () => '$s1',
        getTs: () => 123,
        getRoomId: () => roomId,
      };

      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue([mockEvent]),
        },
      };
      mockSdk.getRoom.mockReturnValue(mockRoom);

      const events = await adapter.receiveStateEvents(EVENT_TYPES.SETTINGS);
      expect(events).toHaveLength(1);
      expect(events[0].content.name).toBe('Test');
      expect(mockSdk.roomState).not.toHaveBeenCalled();
    });

    it('falls back to network and caches promise if sync not done', async () => {
      mockSdk.getRoom.mockReturnValue(null);
      mockSdk.roomState.mockResolvedValue([
        { type: EVENT_TYPES.SETTINGS, content: { name: 'Network' } }
      ]);

      const promise1 = adapter.receiveStateEvents(EVENT_TYPES.SETTINGS);
      const promise2 = adapter.receiveStateEvents(EVENT_TYPES.SETTINGS);

      const [events1, events2] = await Promise.all([promise1, promise2]);

      expect(events1[0].content.name).toBe('Network');
      expect(events2[0].content.name).toBe('Network');
      expect(mockSdk.roomState).toHaveBeenCalledTimes(1);
    });

    it('drops events from a different room (cross-room contamination guard)', () => {
      const subject = adapter.observeStateEvents(EVENT_TYPES.TOKEN);
      const seen = [];
      subject.subscribe(e => seen.push(e));

      const stateCallback = mockSdk.on.mock.calls.find(c => c[0] === 'RoomState.events')[1];
      const foreign = {
        getType: () => EVENT_TYPES.TOKEN,
        getStateKey: () => 't1',
        getContent: () => ({ x: 1 }),
        getSender: () => '@a:m.org',
        getId: () => '$x',
        getTs: () => 0,
        getRoomId: () => '!OTHER:m.org',
      };
      stateCallback(foreign);
      expect(seen).toHaveLength(0);
    });
  });

  describe('sync transitions', () => {
    it('dispatches vtt:sync-recovered on the first PREPARED', () => {
      const events = [];
      const handler = (e) => events.push(e.type);
      window.addEventListener(VTT_EVENTS.SYNC_RECOVERED, handler);
      try {
        const cb = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
        cb('PREPARED');
        expect(events).toContain(VTT_EVENTS.SYNC_RECOVERED);
        expect(adapter._initialSyncDone).toBe(true);
      } finally {
        window.removeEventListener(VTT_EVENTS.SYNC_RECOVERED, handler);
      }
    });

    it('dispatches vtt:sync-dead after 10 consecutive ERROR transitions', () => {
      const events = [];
      const handler = (e) => events.push(e.type);
      window.addEventListener(VTT_EVENTS.SYNC_DEAD, handler);
      try {
        const cb = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
        for (let i = 0; i < 9; i++) cb('ERROR');
        expect(events).toHaveLength(0);
        cb('ERROR'); // 10th
        expect(events).toContain(VTT_EVENTS.SYNC_DEAD);
      } finally {
        window.removeEventListener(VTT_EVENTS.SYNC_DEAD, handler);
      }
    });

    it('a PREPARED after errors resets the consecutive-failure counter', () => {
      const cb = mockSdk.on.mock.calls.find(c => c[0] === 'sync')[1];
      for (let i = 0; i < 5; i++) cb('ERROR');
      cb('PREPARED');
      expect(adapter._consecutiveFailures).toBe(0);
      expect(adapter._syncErrored).toBe(false);
    });
  });

  describe('Room.timeline routing', () => {
    it('forwards paginated history (toStartOfTimeline=true) with _historical: true', () => {
      // Previously this handler dropped the event entirely. That meant a
      // GM's own scenes posted in a prior session never reached
      // activityLog because the matrix-js-sdk delivers them as
      // backfill (toStartOfTimeline=true) on the next page reload, and
      // the downstream chat-intake filter then double-protected via
      // sender == me. Now we forward backfill marked as historical so
      // the downstream pipeline can decide whether to dedup or surface.
      const dispatched = [];
      const handler = (e) => dispatched.push(e.detail);
      window.addEventListener('matrix:timeline-event', handler);
      try {
        const cb = mockSdk.on.mock.calls.find(c => c[0] === 'Room.timeline')[1];
        const event = {
          isState: () => false, isRedacted: () => false,
          getType: () => 'm.room.message',
          getStateKey: () => undefined,
          getContent: () => ({ msgtype: 'm.text', body: 'old', 'com.vtt.scene_root': true }),
          getSender: () => '@gm:m', getId: () => '$scene1', getTs: () => 0, getRoomId: () => roomId,
        };
        cb(event, { roomId }, /*toStartOfTimeline=*/true);
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0]._historical).toBe(true);
        expect(dispatched[0].event_id).toBe('$scene1');
        expect(dispatched[0].content['com.vtt.scene_root']).toBe(true);
      } finally {
        window.removeEventListener('matrix:timeline-event', handler);
      }
    });

    it('drops timeline events from a different room', () => {
      const dispatched = [];
      const handler = () => dispatched.push(true);
      window.addEventListener('matrix:timeline-event', handler);
      try {
        const cb = mockSdk.on.mock.calls.find(c => c[0] === 'Room.timeline')[1];
        const event = {
          isState: () => false, isRedacted: () => false,
          getType: () => 'm.room.message',
          getStateKey: () => undefined,
          getContent: () => ({}),
          getSender: () => '@x:m', getId: () => '$x', getTs: () => 0, getRoomId: () => '!OTHER:m',
        };
        cb(event, { roomId: '!OTHER:m' }, false);
        expect(dispatched).toHaveLength(0);
      } finally {
        window.removeEventListener('matrix:timeline-event', handler);
      }
    });
  });

  describe('replayLiveTimeline (boot-order race recovery)', () => {
    function fakeMessage(id) {
      return {
        isState: () => false, isRedacted: () => false,
        getType: () => 'm.room.message',
        getStateKey: () => undefined,
        getContent: () => ({ msgtype: 'm.text', body: id, 'com.vtt.scene_root': true }),
        getSender: () => '@gm:m', getId: () => id, getTs: () => 0,
        getRoomId: () => roomId,
      };
    }
    function fakeStateEvent() {
      return {
        isState: () => true, isRedacted: () => false,
        getType: () => 'com.vtt.token',
        getStateKey: () => 'tok-1',
        getContent: () => ({}),
        getSender: () => '@gm:m', getId: () => '$state1', getTs: () => 0,
        getRoomId: () => roomId,
      };
    }

    it('re-dispatches non-state timeline events with _historical: true', () => {
      mockSdk.getRoom.mockReturnValue({
        getLiveTimeline: () => ({
          getEvents: () => [fakeMessage('$a'), fakeMessage('$b'), fakeMessage('$c')],
        }),
      });
      const dispatched = [];
      const handler = (e) => dispatched.push(e.detail);
      window.addEventListener('matrix:timeline-event', handler);
      try {
        adapter.replayLiveTimeline();
        expect(dispatched).toHaveLength(3);
        expect(dispatched.map((d) => d.event_id)).toEqual(['$a', '$b', '$c']);
        expect(dispatched.every((d) => d._historical === true)).toBe(true);
      } finally {
        window.removeEventListener('matrix:timeline-event', handler);
      }
    });

    it('skips state events during replay (they apply via the state subjects)', () => {
      mockSdk.getRoom.mockReturnValue({
        getLiveTimeline: () => ({
          getEvents: () => [fakeStateEvent(), fakeMessage('$msg')],
        }),
      });
      const dispatched = [];
      const handler = (e) => dispatched.push(e.detail);
      window.addEventListener('matrix:timeline-event', handler);
      try {
        adapter.replayLiveTimeline();
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].event_id).toBe('$msg');
      } finally {
        window.removeEventListener('matrix:timeline-event', handler);
      }
    });

    it('no-ops when the room is not found', () => {
      mockSdk.getRoom.mockReturnValue(null);
      const dispatched = [];
      const handler = () => dispatched.push(true);
      window.addEventListener('matrix:timeline-event', handler);
      try {
        adapter.replayLiveTimeline();
        expect(dispatched).toHaveLength(0);
      } finally {
        window.removeEventListener('matrix:timeline-event', handler);
      }
    });
  });

  describe('getMessages (scrollback pagination)', () => {
    function fakeEvent(id) {
      return {
        getType: () => 'm.room.message',
        getStateKey: () => undefined,
        getContent: () => ({ msgtype: 'm.text', body: id }),
        getSender: () => '@alice:m.org',
        getId: () => id,
        getTs: () => 0,
        getRoomId: () => roomId,
        isState: () => false,
      };
    }

    function withFakeRoom(initialEvents) {
      const events = [...initialEvents];
      const timeline = {
        getEvents: () => events,
        getPaginationToken: () => 'tok-after',
      };
      const room = {
        roomId,
        getLiveTimeline: () => timeline,
      };
      mockSdk.getRoom.mockReturnValue(room);
      return { room, timeline, events };
    }

    it('paginates via sdk.scrollback and returns the newly-prepended events', async () => {
      const { events } = withFakeRoom([fakeEvent('$known-1'), fakeEvent('$known-2')]);
      mockSdk.scrollback = vi.fn(async () => { events.unshift(fakeEvent('$older-a'), fakeEvent('$older-b')); });

      const result = await adapter.getMessages(50);

      expect(mockSdk.scrollback).toHaveBeenCalledTimes(1);
      expect(result.chunk).toHaveLength(2);
      expect(result.chunk.map((e) => e.event_id)).toEqual(['$older-a', '$older-b']);
      expect(result.end).toBe('tok-after');
      expect(adapter.hasMoreHistory).toBe(true);
    });

    it('flips hasMoreHistory to false when scrollback returns no new events', async () => {
      withFakeRoom([fakeEvent('$x')]);
      mockSdk.scrollback = vi.fn(async () => { /* no new events */ });

      const result = await adapter.getMessages(50);

      expect(result.chunk).toEqual([]);
      expect(result.end).toBeNull();
      expect(adapter.hasMoreHistory).toBe(false);
    });

    it('swallows scrollback errors and stops paginating', async () => {
      withFakeRoom([fakeEvent('$x')]);
      mockSdk.scrollback = vi.fn(async () => { throw new Error('boom'); });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await adapter.getMessages(50);

      expect(result.chunk).toEqual([]);
      expect(result.end).toBeNull();
      expect(adapter.hasMoreHistory).toBe(false);
      warnSpy.mockRestore();
    });

    it('returns empty when the room is not in the SDK store', async () => {
      mockSdk.getRoom.mockReturnValue(null);
      const result = await adapter.getMessages();
      expect(result).toEqual({ chunk: [], end: null });
    });

    it('bails out and does not touch hasMoreHistory when stopSync ran before the call', async () => {
      withFakeRoom([fakeEvent('$x')]);
      mockSdk.scrollback = vi.fn();
      adapter.stopSync();

      const result = await adapter.getMessages();

      expect(result).toEqual({ chunk: [], end: null });
      expect(mockSdk.scrollback).not.toHaveBeenCalled();
      expect(adapter.hasMoreHistory).toBe(true);
    });

    it('honours stopSync that fires mid-scrollback', async () => {
      const { events } = withFakeRoom([fakeEvent('$x')]);
      mockSdk.scrollback = vi.fn(async () => {
        adapter.stopSync();
        events.unshift(fakeEvent('$older'));
      });

      const result = await adapter.getMessages();

      expect(mockSdk.scrollback).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ chunk: [], end: null });
      expect(adapter.hasMoreHistory).toBe(true);
    });
  });
});
