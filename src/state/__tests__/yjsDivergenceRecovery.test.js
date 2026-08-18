/**
 * C3 - When the 30s state-vector check detects a true fork (local
 * has updates remote doesn't AND is missing updates remote has), the
 * StateManager's divergence handler must auto-recover by fetching
 * the latest SNAPSHOT and calling YjsManager.loadSnapshot.
 *
 * When recovery can't find a snapshot, we *don't* surface the
 * "Collaborative state drift detected" user-facing toast anymore -
 * the missing-snapshot case is benign (fresh room with no published
 * snapshot yet, or a transient peer fork that gossip will resolve)
 * and the toast had no actionable next step. The warning still goes
 * to the in-app log via logger.warn for diagnostics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { StateManager } from '../StateManager.js';
import { YJS_EVENT_TYPES } from '../YjsManager.js';
import { VTT_EVENTS } from '../../utils/constants.js';

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

function makeSm(receiveImpl) {
  const api = { receiveStateEvents: vi.fn(receiveImpl) };
  const transport = { onOversizedDiff: null };
  const widgetManager = {
    userId: '@me:s',
    roomId: '!r:s',
    isStandalone: true,
    sendStateEvent: vi.fn().mockResolvedValue('e'),
    getApi: vi.fn().mockReturnValue(api),
    getYjsTransport: vi.fn().mockReturnValue(transport),
  };
  const subscriptionManager = { subscribe: vi.fn() };
  const sm = new StateManager(widgetManager, subscriptionManager);
  sm._wireYjsBridges();
  return { sm, api, transport };
}

describe('StateManager divergence recovery (C3)', () => {
  let errorEvents;
  let errorListener;

  beforeEach(() => {
    errorEvents = [];
    errorListener = (e) => errorEvents.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, errorListener);
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, errorListener);
  });

  it('fetches the latest snapshot and calls loadSnapshot on divergence', async () => {
    const evt = snapshotEvent(1234);
    const { sm, api } = makeSm(() => Promise.resolve([evt]));
    const loadSpy = vi.spyOn(sm.yjs, 'loadSnapshot');

    await sm.yjs._onDivergenceCallback();

    expect(api.receiveStateEvents).toHaveBeenCalledWith(YJS_EVENT_TYPES.SNAPSHOT);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy.mock.calls[0][1]).toBe(1234);
    // No error toast when recovery succeeds.
    expect(errorEvents).toHaveLength(0);
  });

  it('does NOT toast when no snapshot exists (benign: gossip will resolve)', async () => {
    const { sm } = makeSm(() => Promise.resolve([]));
    const loadSpy = vi.spyOn(sm.yjs, 'loadSnapshot');

    await sm.yjs._onDivergenceCallback();

    expect(loadSpy).not.toHaveBeenCalled();
    // Used to dispatch a STATE_DESYNC toast; now silenced. Recovery
    // still gets a logger.warn - verifiable via the in-app log panel.
    expect(errorEvents).toHaveLength(0);
  });

  it('does NOT toast when the snapshot fetch throws', async () => {
    const { sm } = makeSm(() => Promise.reject(new Error('network')));

    await sm.yjs._onDivergenceCallback();

    expect(errorEvents).toHaveLength(0);
  });

  it('wires the transport oversized-diff fallback to a snapshot publish', () => {
    const { transport } = makeSm(() => Promise.resolve([]));
    expect(typeof transport.onOversizedDiff).toBe('function');
  });

  it('debounces: two divergence callbacks within 30s only attempt one recovery', async () => {
    const evt = snapshotEvent(1);
    const { sm, api } = makeSm(() => Promise.resolve([evt]));
    const loadSpy = vi.spyOn(sm.yjs, 'loadSnapshot');

    await sm.yjs._onDivergenceCallback();
    await sm.yjs._onDivergenceCallback();

    expect(api.receiveStateEvents).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});
