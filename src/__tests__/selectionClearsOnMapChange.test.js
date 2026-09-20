/**
 * A marquee selection survived a map switch, so the GM arrived on a new
 * map with "10 selected" and a bulk action bar pointed at ten creatures
 * that were not there. Damage 10 would have hit tokens on the map they
 * just left, none of them visible.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerStateEffects } from '../ui/state-effects.js';
import { selectedTokenIdsSignal } from '../state/ui-signals.js';
import { activeMapIdSignal, settingsSignal } from '../state/signals.js';

function makeUi() {
  return {
    state: { settings: {}, characters: new Map(), initiative: { active: false, order: [] } },
    mapRenderer: null,
    _log: () => {},
    _toast: () => {},
  };
}

let dispose;
beforeEach(() => {
  activeMapIdSignal.value = 'map-a';
  selectedTokenIdsSignal.value = new Set();
  dispose = registerStateEffects(makeUi());
});
afterEach(() => {
  dispose?.();
  selectedTokenIdsSignal.value = new Set();
  activeMapIdSignal.value = null;
  settingsSignal.value = {};
});

describe('token selection across a map switch', () => {
  it('is dropped when the active map changes', () => {
    selectedTokenIdsSignal.value = new Set(['tok-1', 'tok-2']);
    activeMapIdSignal.value = 'map-b';
    expect(selectedTokenIdsSignal.value.size).toBe(0);
  });

  it('survives a change to anything other than the active map', () => {
    selectedTokenIdsSignal.value = new Set(['tok-1']);
    settingsSignal.value = { ...settingsSignal.value, name: 'renamed' };
    expect([...selectedTokenIdsSignal.value]).toEqual(['tok-1']);
  });

  it('does not thrash the signal when the map has not actually changed', () => {
    selectedTokenIdsSignal.value = new Set(['tok-1']);
    activeMapIdSignal.value = 'map-a';
    expect([...selectedTokenIdsSignal.value]).toEqual(['tok-1']);
  });

  it('leaves an already-empty selection alone', () => {
    const before = selectedTokenIdsSignal.value;
    activeMapIdSignal.value = 'map-c';
    expect(selectedTokenIdsSignal.value).toBe(before);
  });
});
