/**
 * Wizard data-loss guards - the residual count and the tombstone sweep
 * must both cover every user-content collection that the wizard's
 * Blank Campaign confirm destroys. The count gates the typed-DELETE
 * double-confirm AND the wizard auto-show gate (render-policy reads
 * residual === 0), so an under-count enables a one-click wipe with no
 * warning on a room whose only content is in a missed collection.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  _countResidualEntities, _fetchStaleVttEvents, tombstoneStaleEvents,
} from '../ui/setup-tombstone.js';
import { EVENT_TYPES } from '../utils/constants.js';

const mapOf = (...ids) => new Map(ids.map((id) => [id, { id }]));

function makeState(over = {}) {
  return {
    tokens: new Map(), characters: new Map(), npcs: new Map(),
    items: new Map(), spells: new Map(), handouts: new Map(),
    tables: new Map(), maps: new Map(), walls: new Map(),
    templates: new Map(), pins: new Map(), lights: new Map(),
    pages: new Map(), drawings: [],
    ...over,
  };
}

describe('_countResidualEntities', () => {
  it('counts a room whose only content is lights', () => {
    const ui = { state: makeState({ lights: mapOf('l1', 'l2') }) };
    expect(_countResidualEntities(ui)).toBe(2);
  });

  it('counts a room whose only content is pages', () => {
    const ui = { state: makeState({ pages: mapOf('p1') }) };
    expect(_countResidualEntities(ui)).toBe(1);
  });

  it('counts every keyed collection the sweep enumerates (invariant)', async () => {
    // One entity in EVERY collection the sweep touches → the count must
    // see all of them, so neither list can drift ahead of the other.
    const state = makeState();
    for (const key of Object.keys(state)) {
      if (state[key] instanceof Map) state[key].set(`${key}-1`, { id: `${key}-1` });
    }
    const ui = { state };
    const sweep = await _fetchStaleVttEvents(ui);
    expect(_countResidualEntities(ui)).toBeGreaterThanOrEqual(sweep.length);
  });
});

describe('tombstone sweep coverage', () => {
  it('enumerates pins, templates, walls, lights, and pages', async () => {
    const ui = {
      state: makeState({
        pins: mapOf('pin1'), templates: mapOf('tpl1'), walls: mapOf('w1'),
        lights: mapOf('l1'), pages: mapOf('pg1'),
      }),
    };
    const targets = await _fetchStaleVttEvents(ui);
    const types = targets.map((t) => t.type);
    expect(types).toContain(EVENT_TYPES.PIN);
    expect(types).toContain(EVENT_TYPES.TEMPLATE);
    expect(types).toContain(EVENT_TYPES.WALL);
    expect(types).toContain(EVENT_TYPES.LIGHT);
    expect(types).toContain(EVENT_TYPES.PAGE);
  });

  it('dispatches each new type to its facade writer', async () => {
    const sm = {
      removePin: vi.fn(), removeTemplate: vi.fn(), removeWall: vi.fn(),
      removeLight: vi.fn(), deletePage: vi.fn(),
    };
    const targets = [
      { type: EVENT_TYPES.PIN, id: 'pin1' },
      { type: EVENT_TYPES.TEMPLATE, id: 'tpl1' },
      { type: EVENT_TYPES.WALL, id: 'w1' },
      { type: EVENT_TYPES.LIGHT, id: 'l1' },
      { type: EVENT_TYPES.PAGE, id: 'pg1' },
    ];

    const failures = await tombstoneStaleEvents({ state: sm }, targets);

    expect(failures).toEqual([]);
    expect(sm.removePin).toHaveBeenCalledWith('pin1');
    expect(sm.removeTemplate).toHaveBeenCalledWith('tpl1');
    expect(sm.removeWall).toHaveBeenCalledWith('w1');
    expect(sm.removeLight).toHaveBeenCalledWith('l1');
    expect(sm.deletePage).toHaveBeenCalledWith('pg1');
  });
});
