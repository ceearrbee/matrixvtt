import { describe, it, expect, vi } from 'vitest';
import { migrateUnscopedEntities } from '../migration-unscoped.js';

function makeYMap(initial = {}) {
  const inner = new Map(Object.entries(initial));
  return {
    set: vi.fn((k, v) => inner.set(k, v)),
    delete: vi.fn((k) => inner.delete(k)),
    has: (k) => inner.has(k),
    get: (k) => inner.get(k),
    keys: () => inner.keys(),
    values: () => inner.values(),
    entries: () => inner.entries(),
    doc: { transact: (fn) => fn() },
    _inner: inner,
  };
}

function makeSm({ isGm = true, mapId = 'map-1' } = {}) {
  return {
    powerLevels: { users: isGm ? { '@gm:m': 50 } : {} },
    widgetManager: { userId: '@gm:m' },
    yjs: {
      doc: { transact: (fn) => fn() },
      wallsMap:    makeYMap({ w1: { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } } }),
      lightsMap:   makeYMap({ l1: { id: 'l1', x: 0, y: 0, radius_px: 50 } }),
      pinsMap:     makeYMap({ p1: { id: 'p1', col: 1, row: 1, label: 'X' } }),
      templatesMap: makeYMap({ t1: { id: 't1', shape: 'circle', origin: { col: 0, row: 0 } } }),
      tokensMap:   makeYMap({ tk1: { id: 'tk1', col: 0, row: 0 } }),
      fogMap:      makeYMap({ '': { mode: 'hidden', revealed: [] } }),
      mapsMap:     makeYMap({ [mapId]: { id: mapId, name: 'Only' } }),
    },
    activeMapId: mapId,
  };
}

describe('migrateUnscopedEntities', () => {
  it('backfills map_id on walls/lights/pins/templates/tokens to the first map id', () => {
    const sm = makeSm({ mapId: 'm-only' });
    migrateUnscopedEntities(sm);
    expect(sm.yjs.wallsMap.set).toHaveBeenCalledWith('w1', expect.objectContaining({ map_id: 'm-only' }));
    expect(sm.yjs.lightsMap.set).toHaveBeenCalledWith('l1', expect.objectContaining({ map_id: 'm-only' }));
    expect(sm.yjs.pinsMap.set).toHaveBeenCalledWith('p1', expect.objectContaining({ map_id: 'm-only' }));
    expect(sm.yjs.templatesMap.set).toHaveBeenCalledWith('t1', expect.objectContaining({ map_id: 'm-only' }));
    expect(sm.yjs.tokensMap.set).toHaveBeenCalledWith('tk1', expect.objectContaining({ map_id: 'm-only' }));
  });

  it('moves legacy fog from key "" to the active map id and deletes the legacy key', () => {
    const sm = makeSm({ mapId: 'm-only' });
    migrateUnscopedEntities(sm);
    expect(sm.yjs.fogMap.set).toHaveBeenCalledWith('m-only', expect.objectContaining({ mode: 'hidden' }));
    expect(sm.yjs.fogMap.delete).toHaveBeenCalledWith('');
  });

  it('is a no-op when called as a non-GM', () => {
    const sm = makeSm({ isGm: false, mapId: 'm-only' });
    migrateUnscopedEntities(sm);
    expect(sm.yjs.wallsMap.set).not.toHaveBeenCalled();
  });

  it('does not rewrite entities that already have map_id', () => {
    const sm = makeSm({ mapId: 'm-only' });
    sm.yjs.wallsMap = makeYMap({ w1: { id: 'w1', map_id: 'm-only', p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } } });
    migrateUnscopedEntities(sm);
    expect(sm.yjs.wallsMap.set).not.toHaveBeenCalled();
  });

  it('backfills map_id on legacy unscoped drawings in the Y.Array', () => {
    const sm = makeSm({ mapId: 'm-only' });
    const drawings = [
      { id: 'd1', type: 'pencil', points: [0, 0, 1, 1] },                  // unscoped
      { id: 'd2', type: 'rect', map_id: 'm-only', x: 0, y: 0 },            // already scoped
    ];
    sm.yjs.drawingsArray = {
      length: drawings.length,
      toArray: () => [...drawings],
      get: (i) => drawings[i],
      delete: vi.fn((start, count) => drawings.splice(start, count)),
      push: vi.fn((items) => drawings.push(...items)),
    };
    migrateUnscopedEntities(sm);
    expect(sm.yjs.drawingsArray.delete).toHaveBeenCalledWith(0, 2);
    expect(sm.yjs.drawingsArray.push).toHaveBeenCalledTimes(1);
    const pushed = sm.yjs.drawingsArray.push.mock.calls[0][0];
    expect(pushed[0].map_id).toBe('m-only');
    expect(pushed[1].map_id).toBe('m-only');
  });

  it('does not touch the drawings array when every entry already has map_id', () => {
    const sm = makeSm({ mapId: 'm-only' });
    const drawings = [
      { id: 'd1', map_id: 'm-only', type: 'pencil', points: [0, 0] },
      { id: 'd2', map_id: 'm-only', type: 'rect', x: 0, y: 0 },
    ];
    sm.yjs.drawingsArray = {
      length: drawings.length,
      toArray: () => [...drawings],
      get: (i) => drawings[i],
      delete: vi.fn(),
      push: vi.fn(),
    };
    migrateUnscopedEntities(sm);
    expect(sm.yjs.drawingsArray.delete).not.toHaveBeenCalled();
    expect(sm.yjs.drawingsArray.push).not.toHaveBeenCalled();
  });
});
