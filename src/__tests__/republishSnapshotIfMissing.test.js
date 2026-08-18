/**
 * republishSnapshotIfMissing - self-heal recovery for rooms left in a
 * partial-snapshot state (a 429 mid-publish once dropped later chunks
 * on the floor). Auto-republishes a complete snapshot on boot when the
 * GM's local Yjs doc has content but the room's published snapshot is
 * absent or incomplete.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { republishSnapshotIfMissing } from '../state/yjs-snapshot-publish.js';
import { YJS_EVENT_TYPES } from '../state/YjsManager.js';

function fullSnapshotEvents(marker = 1) {
  return [{ content: { data: 'b64', marker, idx: 0, total: 1 } }];
}
function partialSnapshotEvents(marker = 1) {
  return [{ content: { data: 'b64', marker, idx: 0, total: 2 } }];
}

function makeSm({ isGM = true, snapshotEvents = [], populateDoc = true } = {}) {
  const doc = new Y.Doc();
  if (populateDoc) {
    // Populate with enough content to clear the MIN_USEFUL bar (64 bytes).
    const m = doc.getMap('tokens');
    for (let i = 0; i < 20; i++) m.set(`tok-${i}`, { x: i, y: i, name: `token-${i}` });
  }
  const sendStateEvent = vi.fn().mockResolvedValue(undefined);
  return {
    yjs: { doc },
    lastSentState: new Map(),
    sendStateEvent,
    widgetManager: {
      canEditRoomState: () => isGM,
      getApi: () => ({
        receiveStateEvents: async (type) => {
          if (type === YJS_EVENT_TYPES.SNAPSHOT) return snapshotEvents;
          return [];
        },
      }),
    },
  };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('republishSnapshotIfMissing', () => {
  it('republishes when the room has a partial snapshot and the doc has content', async () => {
    const sm = makeSm({ snapshotEvents: partialSnapshotEvents() });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(true);
    expect(sm.sendStateEvent).toHaveBeenCalled();
    const [type] = sm.sendStateEvent.mock.calls[0];
    expect(type).toBe(YJS_EVENT_TYPES.SNAPSHOT);
  });

  it('republishes when the room has no snapshot at all', async () => {
    const sm = makeSm({ snapshotEvents: [] });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(true);
    expect(sm.sendStateEvent).toHaveBeenCalled();
  });

  it('no-ops when a complete snapshot already exists', async () => {
    const sm = makeSm({ snapshotEvents: fullSnapshotEvents() });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(false);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('no-ops for non-GM viewers', async () => {
    const sm = makeSm({ isGM: false, snapshotEvents: [] });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(false);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('no-ops when the local Yjs doc is empty (no content to publish)', async () => {
    const sm = makeSm({ snapshotEvents: [], populateDoc: false });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(false);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it("no-ops when the probe returns 'unknown' (don't clobber on a transient error)", async () => {
    const sm = makeSm({ snapshotEvents: partialSnapshotEvents() });
    sm.widgetManager.getApi = () => ({
      receiveStateEvents: async () => { throw new Error('flaky'); },
    });
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(false);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });
});
