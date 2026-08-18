/**
 * bridgeKeyedCollection re-subscribed EVERY entity signal in a collection
 * whenever any single id was added or removed, and scanned the id list with
 * O(n) `includes` per local key. On a 200-token map, adding one token tore
 * down and rebuilt 200 subscriptions (each firing its handler again on
 * re-subscribe) and did 200 linear scans.
 *
 * These tests pin incremental behaviour: only genuinely new ids subscribe,
 * removed ids unsubscribe, and the local ReactiveMap still ends up correct.
 */

import { describe, it, expect, vi } from 'vitest';
import { signal } from '@preact/signals';
import { wireYjsBridges } from '../state/stateManager-yjs-bridges.js';

function makeSubscriptionManager() {
  const active = new Map();
  const subscribeCalls = [];
  const unsubscribeCalls = [];
  return {
    subscribeCalls,
    unsubscribeCalls,
    subscribe(name, source, onNext) {
      subscribeCalls.push(name);
      if (active.has(name)) active.get(name)();
      const dispose = source.subscribe(onNext);
      active.set(name, dispose);
      return { unsubscribe: () => { dispose(); active.delete(name); } };
    },
    unsubscribe(name) {
      unsubscribeCalls.push(name);
      const dispose = active.get(name);
      if (dispose) { dispose(); active.delete(name); }
    },
  };
}

/** Minimal keyed Yjs collection: an `ids` signal plus per-id signals. */
function makeYjsCollection() {
  const ids = signal([]);
  const perId = new Map();
  return {
    ids,
    get(id) { return perId.get(id); },
    _set(id, value) {
      if (!perId.has(id)) perId.set(id, signal(value));
      else perId.get(id).value = value;
    },
    _publishIds() { ids.value = [...perId.keys()]; },
  };
}

const EMPTY_KEYED = () => ({ ids: signal([]), get: () => null });

function makeStateManager(tokensCollection) {
  const local = new Map();
  const subscriptionManager = makeSubscriptionManager();
  const fields = [
    'characters', 'npcs', 'items', 'spells', 'handouts', 'tables',
    'walls', 'lights', 'pins', 'templates', 'maps', 'pages',
  ];
  const sm = {
    subscriptionManager,
    tokens: local,
    yjs: {
      tokens: tokensCollection,
      drawings: { ...EMPTY_KEYED(), get: () => null },
      fog: EMPTY_KEYED(),
      initiative: EMPTY_KEYED(),
      settings: EMPTY_KEYED(),
      onDivergence: () => {},
    },
    isGM: () => true,
    widgetManager: { userId: '@gm:server' },
  };
  for (const f of fields) {
    sm[f] = new Map();
    sm.yjs[f] = EMPTY_KEYED();
  }
  return sm;
}

function tokenSubscribeCalls(sm) {
  return sm.subscriptionManager.subscribeCalls.filter((n) => n.startsWith('yjs:tokens:'));
}

describe('bridgeKeyedCollection incremental subscription', () => {
  it('subscribes each existing id exactly once on the first id emission', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    for (const id of ['a', 'b', 'c']) tokens._set(id, { id });

    wireYjsBridges(sm);
    tokens._publishIds();

    expect(tokenSubscribeCalls(sm).sort()).toEqual(
      ['yjs:tokens:a', 'yjs:tokens:b', 'yjs:tokens:c'],
    );
    expect([...sm.tokens.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('subscribes only the new id when one entity is added', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    for (const id of ['a', 'b', 'c']) tokens._set(id, { id });
    wireYjsBridges(sm);
    tokens._publishIds();
    sm.subscriptionManager.subscribeCalls.length = 0;

    tokens._set('d', { id: 'd' });
    tokens._publishIds();

    expect(tokenSubscribeCalls(sm)).toEqual(['yjs:tokens:d']);
    expect(sm.tokens.get('d')).toEqual({ id: 'd' });
  });

  it('unsubscribes a removed id and drops it from the local map', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    for (const id of ['a', 'b']) tokens._set(id, { id });
    wireYjsBridges(sm);
    tokens._publishIds();

    tokens.ids.value = ['a'];

    expect(sm.subscriptionManager.unsubscribeCalls).toContain('yjs:tokens:b');
    expect(sm.tokens.has('b')).toBe(false);
    expect(sm.tokens.has('a')).toBe(true);
  });

  it('still delivers later per-entity updates for ids kept across emissions', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    tokens._set('a', { id: 'a', col: 0 });
    wireYjsBridges(sm);
    tokens._publishIds();

    tokens._set('b', { id: 'b' });
    tokens._publishIds();
    tokens._set('a', { id: 'a', col: 7 });

    expect(sm.tokens.get('a')).toEqual({ id: 'a', col: 7 });
  });

  it('re-subscribes an id that was removed and later re-added', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    tokens._set('a', { id: 'a' });
    tokens._set('b', { id: 'b' });
    wireYjsBridges(sm);
    tokens._publishIds();

    tokens.ids.value = ['a'];
    sm.subscriptionManager.subscribeCalls.length = 0;
    tokens.ids.value = ['a', 'b'];

    expect(tokenSubscribeCalls(sm)).toEqual(['yjs:tokens:b']);
    expect(sm.tokens.has('b')).toBe(true);
  });

  it('scales the removal scan without a per-key linear id lookup', () => {
    const tokens = makeYjsCollection();
    const sm = makeStateManager(tokens);
    const ids = [];
    for (let i = 0; i < 300; i++) { const id = `t${i}`; ids.push(id); tokens._set(id, { id }); }
    wireYjsBridges(sm);
    tokens._publishIds();

    const includes = vi.spyOn(Array.prototype, 'includes');
    tokens._set('t300', { id: 't300' });
    tokens._publishIds();
    const calls = includes.mock.calls.length;
    includes.mockRestore();

    expect(calls).toBeLessThan(50);
    expect(tokenSubscribeCalls(sm).slice(-1)).toEqual(['yjs:tokens:t300']);
  });
});
