/**
 * Regression: when the same state_key appears in both /sync's `state`
 * (snapshot at start of timeline window) and `timeline` (recent
 * events), the timeline event is newer and must win. With the wipe
 * flow (Blank Campaign) writing 50+ tombstones, those land in the
 * timeline while pre-wipe entities sit in state - preferring state
 * was silently dropping the tombstones and resurrecting old data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatrixApiAdapter } from '../client/MatrixApiAdapter.js';

function makeAdapter() {
  const client = { sync: vi.fn(), }; // not exercised directly
  return new MatrixApiAdapter(client, '!room:hs');
}

describe('_getPrioritizedStateEvents', () => {
  let adapter;
  beforeEach(() => { adapter = makeAdapter(); });

  it('initial sync: timeline tombstone wins over state with content for same key', () => {
    const roomData = {
      state: { events: [
        { type: 'com.vtt.token', state_key: 'tok-aria', event_id: 'e-state', content: { name: 'Aria' } },
      ] },
      timeline: { events: [
        { type: 'com.vtt.token', state_key: 'tok-aria', event_id: 'e-tombstone', content: {} },
      ] },
    };
    const out = adapter._getPrioritizedStateEvents(roomData);
    // The state-with-content entry must NOT be in the result; only the timeline tombstone.
    expect(out.find((e) => e.event_id === 'e-state')).toBeUndefined();
    expect(out.find((e) => e.event_id === 'e-tombstone')).toBeDefined();
  });

  it('keeps state events whose keys are not in the timeline', () => {
    const roomData = {
      state: { events: [
        { type: 'com.vtt.token', state_key: 'tok-untouched', event_id: 'e-keep', content: { name: 'Bob' } },
      ] },
      timeline: { events: [] },
    };
    const out = adapter._getPrioritizedStateEvents(roomData);
    expect(out.map((e) => e.event_id)).toContain('e-keep');
  });

  it('post-initial sync: same priority - timeline wins for shared keys', () => {
    adapter._initialSyncDone = true;
    const roomData = {
      state: { events: [
        { type: 'com.vtt.token', state_key: 'tok-x', event_id: 'e-state-x', content: { name: 'Old' } },
      ] },
      timeline: { events: [
        { type: 'com.vtt.token', state_key: 'tok-x', event_id: 'e-time-x', content: { name: 'New' } },
      ] },
    };
    const out = adapter._getPrioritizedStateEvents(roomData);
    expect(out.find((e) => e.event_id === 'e-state-x')).toBeUndefined();
    expect(out.find((e) => e.event_id === 'e-time-x')).toBeDefined();
  });

  it('collapses multiple chronological versions of the same key to the latest only', () => {
    const roomData = {
      state: { events: [] },
      timeline: { events: [
        { type: 'com.vtt.item', state_key: 'itm-1', event_id: 'e-1', content: { name: 'Old', equipped: '' } },
        { type: 'com.vtt.item', state_key: 'itm-1', event_id: 'e-2', content: { name: 'Mid', equipped: true } },
        { type: 'com.vtt.item', state_key: 'itm-1', event_id: 'e-3', content: {} },
      ] },
    };
    const out = adapter._getPrioritizedStateEvents(roomData);
    // Only the chronologically-last event for itm-1 should be emitted.
    const itm = out.filter((e) => e.state_key === 'itm-1');
    expect(itm).toHaveLength(1);
    expect(itm[0].event_id).toBe('e-3');
    expect(itm[0].content).toEqual({});
  });

  it('preserves chronological order across distinct keys after dedup', () => {
    const roomData = {
      state: { events: [] },
      timeline: { events: [
        { type: 'com.vtt.token', state_key: 'a', event_id: 'a1', content: { name: 'A1' } },
        { type: 'com.vtt.token', state_key: 'b', event_id: 'b1', content: { name: 'B1' } },
        { type: 'com.vtt.token', state_key: 'a', event_id: 'a2', content: { name: 'A2' } },
        { type: 'com.vtt.token', state_key: 'c', event_id: 'c1', content: { name: 'C1' } },
      ] },
    };
    const ids = adapter._getPrioritizedStateEvents(roomData).map((e) => e.event_id);
    expect(ids).toEqual(['b1', 'a2', 'c1']);
  });

  it('ignores non-state timeline events (no state_key)', () => {
    const roomData = {
      state: { events: [] },
      timeline: { events: [
        { type: 'm.room.message', event_id: 'msg-1', content: { body: 'hi' } },
        { type: 'com.vtt.token', state_key: 'tok-y', event_id: 'e-state', content: {} },
      ] },
    };
    const out = adapter._getPrioritizedStateEvents(roomData);
    expect(out.find((e) => e.event_id === 'msg-1')).toBeUndefined();
    expect(out.find((e) => e.event_id === 'e-state')).toBeDefined();
  });
});
