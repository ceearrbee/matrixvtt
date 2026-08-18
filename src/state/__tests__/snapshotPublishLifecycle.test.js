/**
 * Publish lifecycle: unchanged docs skip the republish, and stale
 * snapshot generations are cleared only after a readback confirms the
 * new generation landed complete server-side.
 */
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { publishYjsSnapshot } from '../yjs-snapshot-publish.js';
import { YJS_EVENT_TYPES } from '../YjsManager.js';
import { DEBOUNCE_MS, PERIODIC_MS } from '../snapshot-scheduler.js';

function makeSm({ api = null } = {}) {
  const doc = new Y.Doc();
  doc.getMap('settings').set('', { name: 'campaign-with-enough-bytes-to-publish' });
  doc.getMap('tokens').set('t1', { x: 1, y: 2, name: 'a token with padding' });
  return /** @type {any} */ ({
    yjs: { doc },
    widgetManager: {
      canEditRoomState: vi.fn().mockResolvedValue(true),
      getApi: vi.fn().mockReturnValue(api),
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
}

const snapshotCalls = (sm) =>
  sm.sendStateEvent.mock.calls.filter(([type]) => type === YJS_EVENT_TYPES.SNAPSHOT);

const clearCalls = (sm) =>
  snapshotCalls(sm).filter(([, , content]) => content && Object.keys(content).length === 0);

describe('publishYjsSnapshot vector skip', () => {
  it('skips a republish when the state vector is unchanged', async () => {
    const sm = makeSm();
    expect(await publishYjsSnapshot(sm)).toBe(true);
    const firstCount = snapshotCalls(sm).length;
    expect(firstCount).toBeGreaterThan(0);

    expect(await publishYjsSnapshot(sm)).toBe(true);
    expect(snapshotCalls(sm).length).toBe(firstCount);
  });

  it('republishes after the doc changes', async () => {
    const sm = makeSm();
    await publishYjsSnapshot(sm);
    const firstCount = snapshotCalls(sm).length;

    sm.yjs.doc.getMap('tokens').set('t2', { x: 9 });
    await publishYjsSnapshot(sm);
    expect(snapshotCalls(sm).length).toBeGreaterThan(firstCount);
  });

  it('force overrides the unchanged-vector skip', async () => {
    const sm = makeSm();
    await publishYjsSnapshot(sm);
    const firstCount = snapshotCalls(sm).length;

    expect(await publishYjsSnapshot(sm, { force: true })).toBe(true);
    expect(snapshotCalls(sm).length).toBeGreaterThan(firstCount);
  });
});

describe('publishYjsSnapshot tombstoning', () => {
  it('clears stale generations after readback confirms the new one', async () => {
    const stale = [
      { state_key: '1-0', content: { data: 'AA==', marker: 1, idx: 0, total: 1 } },
      { state_key: '2-0', content: { data: 'AA==', marker: 2, idx: 0, total: 1 } },
    ];
    const api = {
      receiveStateEvents: vi.fn(async () => {
        const sm2 = api._sm;
        const published = snapshotCalls(sm2)
          .filter(([, , content]) => content && content.data)
          .map(([, state_key, content]) => ({ state_key, content }));
        return [...stale, ...published];
      }),
    };
    const sm = makeSm({ api });
    api._sm = sm;

    expect(await publishYjsSnapshot(sm)).toBe(true);
    const clears = clearCalls(sm).map(([, key]) => key);
    expect(clears).toEqual(['1-0']);
  });

  it('does not clear anything when readback shows the publish did not land', async () => {
    const stale = [
      { state_key: '1-0', content: { data: 'AA==', marker: 1, idx: 0, total: 1 } },
      { state_key: '2-0', content: { data: 'AA==', marker: 2, idx: 0, total: 1 } },
      { state_key: '3-0', content: { data: 'AA==', marker: 3, idx: 0, total: 1 } },
    ];
    const api = { receiveStateEvents: vi.fn().mockResolvedValue(stale) };
    const sm = makeSm({ api });

    expect(await publishYjsSnapshot(sm)).toBe(true);
    expect(clearCalls(sm)).toHaveLength(0);
  });
});

describe('snapshot scheduler cadence', () => {
  it('debounces at 15s with a 60s periodic flush', () => {
    expect(DEBOUNCE_MS).toBe(15000);
    expect(PERIODIC_MS).toBe(60000);
  });
});
