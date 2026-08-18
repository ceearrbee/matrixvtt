/**
 * loadLatestSnapshot - shared helper that fetches the SNAPSHOT state
 * event from a room and applies it via YjsManager.loadSnapshot.
 *
 * Two callers: the initial-load path (syncer.js) and the divergence
 * recovery path (StateManager._wireYjsBridges).
 */
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { YJS_EVENT_TYPES } from '../YjsManager.js';
import { loadLatestSnapshot } from '../yjsSnapshot.js';

function snapshotEvent(marker = Date.now()) {
  const doc = new Y.Doc();
  doc.getMap('tokens').set('t1', { id: 't1' });
  const update = Y.encodeStateAsUpdate(doc);
  return {
    type: YJS_EVENT_TYPES.SNAPSHOT,
    state_key: '',
    content: { data: btoa(String.fromCharCode(...update)), marker },
  };
}

function makeSm() {
  return { yjs: { loadSnapshot: vi.fn() } };
}

describe('loadLatestSnapshot', () => {
  it('decodes and applies the snapshot when one is present', async () => {
    const evt = snapshotEvent(1000);
    const api = { receiveStateEvents: vi.fn().mockResolvedValue([evt]) };
    const sm = makeSm();

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(true);
    expect(api.receiveStateEvents).toHaveBeenCalledWith(YJS_EVENT_TYPES.SNAPSHOT);
    expect(sm.yjs.loadSnapshot).toHaveBeenCalledTimes(1);
    const [bytes, marker] = sm.yjs.loadSnapshot.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(marker).toBe(1000);
  });

  it('returns false and does not call loadSnapshot when no snapshot event exists', async () => {
    const api = { receiveStateEvents: vi.fn().mockResolvedValue([]) };
    const sm = makeSm();

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(false);
    expect(sm.yjs.loadSnapshot).not.toHaveBeenCalled();
  });

  it('returns false when the snapshot has malformed content', async () => {
    const bad = { type: YJS_EVENT_TYPES.SNAPSHOT, state_key: '', content: { data: null } };
    const api = { receiveStateEvents: vi.fn().mockResolvedValue([bad]) };
    const sm = makeSm();

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(false);
    expect(sm.yjs.loadSnapshot).not.toHaveBeenCalled();
  });

  it('swallows fetch errors and returns false', async () => {
    const api = { receiveStateEvents: vi.fn().mockRejectedValue(new Error('boom')) };
    const sm = makeSm();

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(false);
    expect(sm.yjs.loadSnapshot).not.toHaveBeenCalled();
  });

  it('swallows decode errors (invalid base64) and returns false', async () => {
    const corrupt = {
      type: YJS_EVENT_TYPES.SNAPSHOT,
      state_key: '',
      content: { data: 'not-base64-!!!', marker: Date.now() },
    };
    const api = { receiveStateEvents: vi.fn().mockResolvedValue([corrupt]) };
    const sm = { yjs: { loadSnapshot: vi.fn().mockImplementation(() => { throw new Error('bad bytes'); }) } };

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(false);
  });

  it('picks a valid snapshot even when older invalid events are present', async () => {
    const valid = snapshotEvent(2000);
    const invalid = { type: YJS_EVENT_TYPES.SNAPSHOT, state_key: '', content: {} };
    const api = { receiveStateEvents: vi.fn().mockResolvedValue([invalid, valid]) };
    const sm = makeSm();

    const ok = await loadLatestSnapshot(sm, api);

    expect(ok).toBe(true);
    expect(sm.yjs.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(sm.yjs.loadSnapshot.mock.calls[0][1]).toBe(2000);
  });
});
