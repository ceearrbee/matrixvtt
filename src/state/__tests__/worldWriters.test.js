/**
 * Direct unit tests for state/writers/world-writers.js. Post-1.1b every
 * write goes through Yjs; the LWW version-guard, rollback-on-failure
 * patterns are gone (CRDT semantics replace them). Tests pin the new
 * Yjs-write contract.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  updateFog,
  createMap,
  updateMap,
  deleteMap,
  switchMap,
  addWall,
  updateWall,
  removeWall,
  addPin,
  addLight,
  updateLight,
  removeLight,
  clearLights,
} from '../writers/world-writers.js';
import { fogSignal, activeMapIdSignal } from '../signals.js';

function makeYMap() {
  const inner = new Map();
  return {
    set: vi.fn((k, v) => inner.set(k, v)),
    delete: vi.fn((k) => inner.delete(k)),
    has: (k) => inner.has(k),
    get: (k) => inner.get(k),
    doc: { transact: (fn) => fn() },
    _inner: inner,
  };
}

function makeSm({ isGm = true, activeMapId = 'map-default' } = {}) {
  return {
    settings: {},
    powerLevels: { users: isGm ? { '@gm:m': 50 } : {} },
    widgetManager: { userId: '@gm:m' },
    fog: { mode: 'hidden', revealed: [] },
    maps: new Map(),
    walls: new Map(),
    lights: new Map(),
    pins: new Map(),
    activeMapId,
    yjs: {
      fogMap: makeYMap(),
      mapsMap: makeYMap(),
      wallsMap: makeYMap(),
      lightsMap: makeYMap(),
      pinsMap: makeYMap(),
      settingsMap: makeYMap(),
    },
  };
}

describe('updateFog (Yjs-routed)', () => {
  it('writes through yjs.fogMap keyed by activeMapId and strips version fields', async () => {
    const sm = makeSm();
    await updateFog(sm, { mode: 'revealed', revealed: ['1,1'], base_version: 7, version: 7 });
    const [key, persisted] = sm.yjs.fogMap.set.mock.calls[0];
    expect(key).toBe('map-default');
    expect(persisted.mode).toBe('revealed');
    expect(persisted.base_version).toBeUndefined();
    expect(persisted.version).toBeUndefined();
  });

  it('is a no-op when activeMapId is null', async () => {
    const sm = makeSm({ activeMapId: null });
    await updateFog(sm, { mode: 'revealed' });
    expect(sm.yjs.fogMap.set).not.toHaveBeenCalled();
  });

  it('does not throw when caller supplies a stale base_version (CRDT, no guard)', async () => {
    const sm = makeSm();
    await expect(updateFog(sm, { base_version: 1, mode: 'revealed' })).resolves.toBeUndefined();
  });
});

describe('GM-only map mutations', () => {
  it('createMap throws for non-GMs', async () => {
    const sm = makeSm({ isGm: false });
    await expect(createMap(sm, { name: 'X' })).rejects.toThrow(/Only the GM/);
  });

  it('updateMap throws for non-GMs', async () => {
    const sm = makeSm({ isGm: false });
    await expect(updateMap(sm, 'm1', { name: 'X' })).rejects.toThrow(/Only the GM/);
  });

  it('deleteMap throws for non-GMs', async () => {
    const sm = makeSm({ isGm: false });
    sm.maps.set('m1', {});
    sm.maps.set('m2', {});
    await expect(deleteMap(sm, 'm1')).rejects.toThrow(/Only the GM/);
  });

  it('deleteMap refuses to delete the only map', async () => {
    const sm = makeSm();
    sm.maps.set('m1', { name: 'Only' });
    await expect(deleteMap(sm, 'm1')).rejects.toThrow(/Cannot delete/);
    expect(sm.yjs.mapsMap.delete).not.toHaveBeenCalled();
  });

  it('updateMap writes through yjs.mapsMap', async () => {
    const sm = makeSm();
    await updateMap(sm, 'm1', { name: 'A' });
    expect(sm.yjs.mapsMap.set).toHaveBeenCalledWith('m1', { name: 'A' });
  });
});

describe('switchMap', () => {
  it('is a no-op when the target id is unknown', async () => {
    const sm = makeSm();
    sm.maps.set('m1', {});
    sm.activeMapId = 'm1';
    await switchMap(sm, 'm-missing');
    expect(sm.yjs.settingsMap.set).not.toHaveBeenCalled();
  });

  it('writes settings { active_map_id } through yjs.settingsMap', async () => {
    const sm = makeSm();
    sm.maps.set('m1', {});
    sm.maps.set('m2', {});
    await switchMap(sm, 'm2');
    expect(sm.yjs.settingsMap.set.mock.calls[0][0]).toBe('');
    expect(sm.yjs.settingsMap.set.mock.calls[0][1]).toEqual(
      expect.objectContaining({ active_map_id: 'm2' })
    );
  });

  it('never persists the resolved systemConfig into room state', async () => {
    const sm = makeSm();
    sm.settings.system = 'risus';
    sm.settings.systemConfig = { meta: { name: 'Risus' }, character_sheet: {} };
    sm.maps.set('m1', {});
    await switchMap(sm, 'm1');
    const persisted = sm.yjs.settingsMap.set.mock.calls[0][1];
    expect(persisted.systemConfig).toBeUndefined();
    expect(persisted.active_map_id).toBe('m1');
    expect(persisted.system).toBe('risus');
  });
});

describe('wall + pin mutations route through Yjs', () => {
  it('addWall stores via yjs.wallsMap', async () => {
    const sm = makeSm();
    await addWall(sm, { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } });
    expect(sm.yjs.wallsMap.set).toHaveBeenCalledWith('w1', expect.objectContaining({ id: 'w1' }));
  });

  it('updateWall merges the patch and writes through yjs.wallsMap', async () => {
    const sm = makeSm();
    sm.walls.set('w1', { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 }, blocks_movement: true });
    await updateWall(sm, 'w1', { blocks_movement: false });
    const last = sm.yjs.wallsMap.set.mock.calls[0][1];
    expect(last.blocks_movement).toBe(false);
    expect(last.id).toBe('w1');
  });

  it('removeWall deletes via yjs.wallsMap', async () => {
    const sm = makeSm();
    sm.walls.set('w1', { id: 'w1' });
    await removeWall(sm, 'w1');
    expect(sm.yjs.wallsMap.delete).toHaveBeenCalledWith('w1');
  });
});

describe('lights mutations route through Yjs', () => {
  it('addLight rejects lights missing id', async () => {
    const sm = makeSm();
    await expect(addLight(sm, { x: 0, y: 0, radius_px: 50 })).rejects.toThrow(/must have id/);
  });

  it('addLight stores via yjs.lightsMap', async () => {
    const sm = makeSm();
    await addLight(sm, { id: 'l1', x: 10, y: 20, radius_px: 100 });
    expect(sm.yjs.lightsMap.set).toHaveBeenCalledWith('l1', expect.objectContaining({ id: 'l1', radius_px: 100 }));
  });

  it('updateLight merges patch and writes through yjs.lightsMap', async () => {
    const sm = makeSm();
    sm.lights.set('l1', { id: 'l1', x: 0, y: 0, radius_px: 50, color: 'ff0000' });
    await updateLight(sm, 'l1', { radius_px: 80 });
    const last = sm.yjs.lightsMap.set.mock.calls[0][1];
    expect(last.radius_px).toBe(80);
    expect(last.color).toBe('ff0000');
    expect(last.id).toBe('l1');
  });

  it('updateLight is a no-op when light is unknown', async () => {
    const sm = makeSm();
    await updateLight(sm, 'missing', { radius_px: 80 });
    expect(sm.yjs.lightsMap.set).not.toHaveBeenCalled();
  });

  it('removeLight deletes via yjs.lightsMap', async () => {
    const sm = makeSm();
    sm.lights.set('l1', { id: 'l1' });
    await removeLight(sm, 'l1');
    expect(sm.yjs.lightsMap.delete).toHaveBeenCalledWith('l1');
  });

  it('clearLights deletes every entry in a single transact', async () => {
    const sm = makeSm();
    sm.lights.set('l1', { id: 'l1' });
    sm.lights.set('l2', { id: 'l2' });
    await clearLights(sm);
    expect(sm.yjs.lightsMap.delete).toHaveBeenCalledTimes(2);
  });
});

describe('updateFog - per-map fog (Phase 1)', () => {
  it('writes fog under the active map id, not the empty key', async () => {
    const sm = makeSm();
    sm.activeMapId = 'map-keep';
    activeMapIdSignal.value = 'map-keep';
    await updateFog(sm, { mode: 'revealed', revealed: ['1,1'] });
    const calls = sm.yjs.fogMap.set.mock.calls;
    expect(calls[0][0]).toBe('map-keep');
    expect(calls[0][1]).toEqual({ mode: 'revealed', revealed: ['1,1'] });
  });

  it("reading fogSignal.value.get(activeMapId) returns that map's fog state", () => {
    fogSignal.value = new Map([
      ['map-keep', { mode: 'hidden', revealed: ['0,0'] }],
      ['map-surface', { mode: 'revealed', revealed: [] }],
    ]);
    activeMapIdSignal.value = 'map-keep';
    expect(fogSignal.value.get('map-keep').revealed).toEqual(['0,0']);
  });
});

describe('addPin', () => {
  it('rejects pins missing id', async () => {
    const sm = makeSm();
    await expect(addPin(sm, { x: 0, y: 0 })).rejects.toThrow(/must have id/);
  });

  it('writes through yjs.pinsMap with valid payload', async () => {
    const sm = makeSm();
    await addPin(sm, { id: 'p1', col: 0, row: 0, label: 'X' });
    expect(sm.yjs.pinsMap.set).toHaveBeenCalled();
    const [key, value] = sm.yjs.pinsMap.set.mock.calls[0];
    expect(key).toBe('p1');
    expect(value.id).toBe('p1');
    expect(value.col).toBe(0);
    expect(value.row).toBe(0);
    expect(value.map_id).toBeDefined();
  });
});
