/**
 * loadInitialState reads only the authoritative Yjs SNAPSHOT from /state.
 * Every other VTT type lives in Yjs; the legacy per-type LWW fetch loop
 * is gone.
 */

import { describe, it, expect, vi } from 'vitest';
import { loadInitialState } from '../syncer.js';
import { YJS_EVENT_TYPES } from '../YjsManager.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function makeStubSM() {
  const receiveStateEvents = vi.fn().mockResolvedValue([]);
  const api = { receiveStateEvents, observeStateEvents: vi.fn() };
  const sm = {
    widgetManager: { getApi: () => api, isStandalone: false },
    yjs: { loadSnapshot: vi.fn() },
    tokens: new Map(), characters: new Map(), npcs: new Map(),
    items: new Map(), spells: new Map(), handouts: new Map(),
    tables: new Map(), pins: new Map(), templates: new Map(),
    walls: new Map(), lights: new Map(), maps: new Map(),
    drawings: [], roomMembers: [], damageLog: [], activeMapId: null,
    settings: {},
  };
  return { sm, api, receiveStateEvents };
}

describe('loadInitialState', () => {
  it('fetches power levels and the Yjs SNAPSHOT (the legacy per-type LWW fetch is gone)', async () => {
    const { sm, receiveStateEvents } = makeStubSM();

    await loadInitialState(sm);

    expect(receiveStateEvents).toHaveBeenCalledWith(YJS_EVENT_TYPES.SNAPSHOT);
    const calledTypes = receiveStateEvents.mock.calls.map((c) => c[0]);
    // Power levels first, then the snapshot; no per-type LWW fetches.
    expect(calledTypes).toEqual([EVENT_TYPES.POWER_LEVELS, YJS_EVENT_TYPES.SNAPSHOT]);
  });

  it('does not throw when no snapshot is present', async () => {
    const { sm } = makeStubSM();
    await expect(loadInitialState(sm)).resolves.not.toThrow();
  });
});
