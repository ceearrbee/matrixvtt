/**
 * _countResidualEntities is the gate that decides whether the Setup
 * Wizard's banner warns the user about existing data. Per the
 * production audit's wizard-data-loss cluster, the original count
 * excluded spells / drawings / walls / templates / pins - a user
 * could see "0 entities" and confirm a wipe that destroyed dozens
 * of unaccounted-for items.
 *
 * This test pins every collection the count must enumerate.
 */
import { describe, it, expect } from 'vitest';
import { _countResidualEntities } from '../ui/setup-tombstone.js';

const stub = (mapEntries = []) => new Map(mapEntries.map((id) => [id, { id }]));

function makeUi(stateOverrides = {}) {
  return {
    state: {
      tokens:     new Map(),
      characters: new Map(),
      npcs:       new Map(),
      items:      new Map(),
      spells:     new Map(),
      handouts:   new Map(),
      tables:     new Map(),
      walls:      new Map(),
      templates:  new Map(),
      pins:       new Map(),
      drawings:   [],
      ...stateOverrides,
    },
  };
}

describe('_countResidualEntities', () => {
  it('returns 0 for a fresh blank room', () => {
    expect(_countResidualEntities(makeUi())).toBe(0);
  });

  it('counts every entity-typed collection', () => {
    const ui = makeUi({
      tokens:     stub(['t1', 't2']),
      characters: stub(['c1']),
      npcs:       stub(['n1', 'n2']),
      items:      stub(['i1']),
      spells:     stub(['s1']),
      handouts:   stub(['h1']),
      tables:     stub(['tb1']),
      walls:      stub(['w1', 'w2']),
      templates:  stub(['tp1']),
      pins:       stub(['p1', 'p2', 'p3']),
      drawings:   [{ id: 'd1' }, { id: 'd2' }],
    });
    // 2+1+2+1+1+1+1+2+1+3+2 = 17
    expect(_countResidualEntities(ui)).toBe(17);
  });

  it('includes drawings (array, not Map)', () => {
    const ui = makeUi({ drawings: [{}, {}, {}, {}] });
    expect(_countResidualEntities(ui)).toBe(4);
  });

  it('includes walls + templates + pins (the audit-flagged exclusions)', () => {
    expect(_countResidualEntities(makeUi({ walls: stub(['w1']) }))).toBe(1);
    expect(_countResidualEntities(makeUi({ templates: stub(['t1']) }))).toBe(1);
    expect(_countResidualEntities(makeUi({ pins: stub(['p1']) }))).toBe(1);
    expect(_countResidualEntities(makeUi({ spells: stub(['s1']) }))).toBe(1);
  });

  it('handles missing collections defensively', () => {
    expect(_countResidualEntities({ state: {} })).toBe(0);
  });
});
