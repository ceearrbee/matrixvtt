/**
 * Outbound validation: writers must run their schemas before any
 * Yjs write goes out. Pre-fix the validators in
 * `src/utils/schemas/content.js` were orphaned - the inbound syncer
 * used them but writers wrote whatever was passed in. A bug in a
 * form or dev tool could ship invalid records to other clients
 * before failing inbound on their side.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { addPin, updatePin, addLight, addWall } from '../state/writers/world-writers.js';

function makeSm() {
  const doc = new Y.Doc();
  return {
    yjs: {
      doc,
      pinsMap:    doc.getMap('pins'),
      lightsMap:  doc.getMap('lights'),
      wallsMap:   doc.getMap('walls'),
    },
    pins:   new Map(),
    lights: new Map(),
    walls:  new Map(),
    activeMapId: 'map-1',
    settings: {},
    powerLevels: { users: { '@me:hs': 50 } },
    widgetManager: { userId: '@me:hs', isStandalone: true },
  };
}

describe('writer-side validation', () => {
  it('addPin auto-fills map_id from activeMapId and writes a valid pin', async () => {
    const sm = makeSm();
    await addPin(sm, { id: 'pin-1', col: 3, row: 5, label: 'X' });
    const stored = sm.yjs.pinsMap.get('pin-1');
    expect(stored.map_id).toBe('map-1');
    expect(stored.col).toBe(3);
  });

  it('addPin rejects a malformed payload (NaN col)', async () => {
    const sm = makeSm();
    await expect(addPin(sm, { id: 'pin-2', col: NaN, row: 0 })).rejects.toThrow();
    expect(sm.yjs.pinsMap.has('pin-2')).toBe(false);
  });

  it('addLight rejects a negative radius', async () => {
    const sm = makeSm();
    await expect(addLight(sm, {
      id: 'l-1', x: 100, y: 100, radius_px: -5,
    })).rejects.toThrow();
    expect(sm.yjs.lightsMap.has('l-1')).toBe(false);
  });

  it('addWall rejects a payload missing p1/p2 endpoints', async () => {
    const sm = makeSm();
    await expect(addWall(sm, { id: 'w-1' })).rejects.toThrow();
    expect(sm.yjs.wallsMap.has('w-1')).toBe(false);
  });

  it('updatePin preserves existing map_id even when patch omits it', async () => {
    const sm = makeSm();
    sm.pins.set('pin-3', { id: 'pin-3', map_id: 'map-other', col: 1, row: 1 });
    sm.yjs.pinsMap.set('pin-3', { id: 'pin-3', map_id: 'map-other', col: 1, row: 1 });
    await updatePin(sm, 'pin-3', { label: 'updated' });
    const stored = sm.yjs.pinsMap.get('pin-3');
    expect(stored.map_id).toBe('map-other');
    expect(stored.label).toBe('updated');
  });
});
