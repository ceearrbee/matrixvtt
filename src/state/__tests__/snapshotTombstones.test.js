import { describe, it, expect, vi } from 'vitest';
import { selectKeysToClear, clearOldSnapshotGenerations } from '../snapshot-tombstones.js';
import { YJS_EVENT_TYPES } from '../YjsManager.js';

function gen(marker, total, presentIdxs = null) {
  const idxs = presentIdxs ?? [...Array(total).keys()];
  return idxs.map((idx) => ({
    state_key: `${marker}-${idx}`,
    content: { data: 'AA==', marker, idx, total },
  }));
}

describe('selectKeysToClear', () => {
  it('keeps the two newest complete generations and clears older ones', () => {
    const events = [...gen(100, 2), ...gen(200, 2), ...gen(300, 2)];
    expect(selectKeysToClear(events).sort()).toEqual(['100-0', '100-1']);
  });

  it('never clears the newest generation even when incomplete', () => {
    const events = [...gen(100, 2), ...gen(200, 2), ...gen(400, 2, [0])];
    expect(selectKeysToClear(events)).toEqual([]);
  });

  it('clears old incomplete generations (failed publishes)', () => {
    const events = [...gen(100, 3, [0, 1]), ...gen(200, 2), ...gen(300, 2)];
    expect(selectKeysToClear(events).sort()).toEqual(['100-0', '100-1']);
  });

  it('clears markerless legacy events last, and only when a complete generation exists', () => {
    const legacy = { state_key: '', content: { data: 'AA==' } };
    const withComplete = [...gen(200, 1), ...gen(300, 1), ...gen(100, 1), legacy];
    expect(selectKeysToClear(withComplete)).toEqual(['100-0', '']);

    const withoutComplete = [gen(400, 2, [0])[0], legacy];
    expect(selectKeysToClear(withoutComplete)).toEqual([]);
  });

  it('caps the number of clears per cycle', () => {
    const events = [];
    for (let m = 1; m <= 30; m++) events.push(...gen(m, 1));
    events.push(...gen(1000, 1), ...gen(1001, 1));
    expect(selectKeysToClear(events, { maxClears: 20 })).toHaveLength(20);
  });

  it('ignores already-cleared (empty content) events', () => {
    const events = [
      ...gen(200, 1), ...gen(300, 1),
      { state_key: '100-0', content: {} },
      { state_key: '50-0', content: null },
    ];
    expect(selectKeysToClear(events)).toEqual([]);
  });
});

describe('clearOldSnapshotGenerations', () => {
  it('sends empty content for every selected key through sm.sendStateEvent', async () => {
    const events = [...gen(100, 2), ...gen(200, 2), ...gen(300, 2)];
    const sm = {
      widgetManager: { getApi: () => ({ receiveStateEvents: vi.fn().mockResolvedValue(events) }) },
      sendStateEvent: vi.fn().mockResolvedValue({}),
    };
    const cleared = await clearOldSnapshotGenerations(sm);
    expect(cleared).toBe(2);
    expect(sm.sendStateEvent).toHaveBeenCalledWith(YJS_EVENT_TYPES.SNAPSHOT, '100-0', {});
    expect(sm.sendStateEvent).toHaveBeenCalledWith(YJS_EVENT_TYPES.SNAPSHOT, '100-1', {});
  });

  it('no-ops without an api', async () => {
    const sm = { widgetManager: { getApi: () => null }, sendStateEvent: vi.fn() };
    expect(await clearOldSnapshotGenerations(sm)).toBe(0);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });
});
