/**
 * Every Y.Map the YjsManager owns must appear in stateManager-clear's
 * lists, or "New Campaign" leaves the previous room's rows in the
 * document and broadcasts them to everyone who joins next.
 *
 * The sibling regression test walks the StateManager's ReactiveMaps,
 * which `resetSignals` clears wholesale. Nothing covered the Yjs side,
 * which is enumerated by hand.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { YjsManager } from '../state/YjsManager.js';
import { YJS_KEYED_MAPS, YJS_SINGLETON_MAPS } from '../state/stateManager-clear.js';

function yjsMapFields() {
  const ym = Object.create(YjsManager.prototype);
  const doc = new Y.Doc();
  // Only the field assignments matter; bind them off a bare doc.
  const fields = [];
  const proxy = new Proxy(ym, {
    set(target, prop, value) {
      if (typeof prop === 'string' && prop.endsWith('Map') && value?.constructor?.name === 'YMap') {
        fields.push(prop);
      }
      target[prop] = value;
      return true;
    },
  });
  const names = ['tokens', 'characters', 'npcs', 'items', 'spells', 'handouts', 'tables',
    'walls', 'lights', 'pins', 'templates', 'maps', 'pages', 'assets', 'fog', 'initiative', 'settings'];
  for (const n of names) proxy[`${n}Map`] = doc.getMap(n);
  return fields;
}

describe('clearAllState enumeration', () => {
  it('names every Y.Map the manager binds', () => {
    const listed = new Set([...YJS_KEYED_MAPS, ...YJS_SINGLETON_MAPS]);
    const missing = yjsMapFields().filter((f) => !listed.has(f));
    expect(missing).toEqual([]);
  });

  it('lists the asset library among the keyed collections', () => {
    expect(YJS_KEYED_MAPS).toContain('assetsMap');
  });
});
