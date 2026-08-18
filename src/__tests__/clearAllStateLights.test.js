/**
 * Regression for the lightsMap cross-room data leak.
 *
 * `clearAllState({ clearYjs: true })` must enumerate every Yjs keyed
 * map. Pre-fix, `lightsMap` was created in YjsManager but missing
 * from the enumeration in stateManager-clear.js - so dev resets /
 * room teardowns left light state from the prior campaign visible
 * in the next one.
 *
 * clearAll/destroy must enumerate every collection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { clearAllState } from '../state/stateManager-clear.js';

function makeFakeSm() {
  const doc = new Y.Doc();
  return {
    yjs: {
      doc,
      tokensMap:      doc.getMap('tokens'),
      charactersMap:  doc.getMap('characters'),
      npcsMap:        doc.getMap('npcs'),
      itemsMap:       doc.getMap('items'),
      spellsMap:      doc.getMap('spells'),
      handoutsMap:    doc.getMap('handouts'),
      tablesMap:      doc.getMap('tables'),
      pinsMap:        doc.getMap('pins'),
      templatesMap:   doc.getMap('templates'),
      wallsMap:       doc.getMap('walls'),
      lightsMap:      doc.getMap('lights'),
      mapsMap:        doc.getMap('maps'),
      pagesMap:       doc.getMap('pages'),
      fogMap:         doc.getMap('fog'),
      initiativeMap:  doc.getMap('initiative'),
      settingsMap:    doc.getMap('settings'),
      drawingsArray:  doc.getArray('drawings'),
    },
    tokens:     new Map(),
    characters: new Map(),
    npcs:       new Map(),
    items:      new Map(),
    spells:     new Map(),
    handouts:   new Map(),
    tables:     new Map(),
    pins:       new Map(),
    templates:  new Map(),
    walls:      new Map(),
    lights:     new Map(),
    maps:       new Map(),
    pages:      new Map(),
    drawings:   [],
    roomMembers: [],
    activeMapId: null,
  };
}

describe('clearAllState - Yjs keyed maps enumeration', () => {
  let sm;
  beforeEach(() => { sm = makeFakeSm(); });

  it('clears lightsMap as part of clearYjs (regression for cross-room leak)', () => {
    sm.yjs.lightsMap.set('light-a', { id: 'light-a', col: 1, row: 1, radius: 30 });
    sm.yjs.lightsMap.set('light-b', { id: 'light-b', col: 2, row: 2, radius: 60 });
    expect(sm.yjs.lightsMap.size).toBe(2);

    clearAllState(sm, { clearYjs: true });

    expect(sm.yjs.lightsMap.size).toBe(0);
  });

  it('also clears every other keyed map alongside lights', () => {
    const keyed = [
      'tokensMap', 'charactersMap', 'npcsMap', 'itemsMap', 'spellsMap',
      'handoutsMap', 'tablesMap', 'pinsMap', 'templatesMap', 'wallsMap',
      'lightsMap', 'mapsMap', 'pagesMap',
    ];
    for (const name of keyed) sm.yjs[name].set('a', { id: 'a' });

    clearAllState(sm, { clearYjs: true });

    for (const name of keyed) {
      expect(sm.yjs[name].size, `${name} should be cleared`).toBe(0);
    }
  });

  it('clears Yjs drawings array too', () => {
    sm.yjs.drawingsArray.push([{ id: 'd1' }, { id: 'd2' }]);
    expect(sm.yjs.drawingsArray.length).toBe(2);
    clearAllState(sm, { clearYjs: true });
    expect(sm.yjs.drawingsArray.length).toBe(0);
  });
});
