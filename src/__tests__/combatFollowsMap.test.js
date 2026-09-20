/**
 * Whether the combat tracker comes with you to a new map.
 *
 * Initiative is one global order, so switching maps left the strip
 * listing combatants who were not on the map any more, and End Turn
 * could advance to a creature nobody could see. Which behaviour is
 * right depends on the fiction, so it is the GM's choice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchMap } from '../state/writers/world-writers.js';

function makeSm({ combatFollowsMap, active = true } = {}) {
  const settings = { active_map_id: 'map-a' };
  if (combatFollowsMap !== undefined) settings.combat_follows_map = combatFollowsMap;
  const sm = {
    settings,
    maps: new Map([['map-a', { id: 'map-a' }], ['map-b', { id: 'map-b' }]]),
    powerLevels: { users: { '@gm:m': 50 } },
    widgetManager: { userId: '@gm:m' },
    initiative: { active, round: 2, current_index: 1, order: [{ token_id: 't1', name: 'Kael' }] },
    yjs: {
      settingsMap: { set: vi.fn((k, v) => { sm.settings = v; }) },
      initiativeMap: { set: vi.fn() },
    },
    updateSettings: vi.fn(),
  };
  return sm;
}

describe('switchMap and the combat tracker', () => {
  let sm;
  beforeEach(() => { sm = null; });

  it('keeps combat by default, which is what it always did', async () => {
    sm = makeSm();
    await switchMap(sm, 'map-b');
    expect(sm.yjs.initiativeMap.set).not.toHaveBeenCalled();
  });

  it('keeps combat when the GM has asked it to follow', async () => {
    sm = makeSm({ combatFollowsMap: true });
    await switchMap(sm, 'map-b');
    expect(sm.yjs.initiativeMap.set).not.toHaveBeenCalled();
  });

  it('ends combat when the GM has asked it not to follow', async () => {
    sm = makeSm({ combatFollowsMap: false });
    await switchMap(sm, 'map-b');
    expect(sm.yjs.initiativeMap.set).toHaveBeenCalledWith('', expect.objectContaining({
      active: false, round: 0, current_index: 0, order: [],
    }));
  });

  it('leaves a map switch out of combat alone either way', async () => {
    sm = makeSm({ combatFollowsMap: false, active: false });
    await switchMap(sm, 'map-b');
    expect(sm.yjs.initiativeMap.set).not.toHaveBeenCalled();
  });

  it('does nothing at all when the map does not exist', async () => {
    sm = makeSm({ combatFollowsMap: false });
    await switchMap(sm, 'nope');
    expect(sm.yjs.initiativeMap.set).not.toHaveBeenCalled();
  });

  it('still switches the map when it ends combat', async () => {
    sm = makeSm({ combatFollowsMap: false });
    await switchMap(sm, 'map-b');
    expect(sm.settings.active_map_id).toBe('map-b');
  });
});
