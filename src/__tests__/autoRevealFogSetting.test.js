/**
 * `auto_reveal_fog` gates the reveal that follows a moving token.
 *
 * The reveal used to run unconditionally, so the GM's toggle was
 * decoration. The default is on, because always-on is the behaviour
 * the app actually shipped and a gate must not silently switch a
 * feature off for existing rooms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTokenPosition } from '../state/writer.js';
import { COMBAT_DEFAULTS, setCombatSetting } from '../utils/combat-settings.js';
import { STORAGE_KEYS } from '../utils/constants.js';

const map10 = { width_cells: 10, height_cells: 10, cell_px: 40 };

function makeSm(token) {
  const sm = {
    tokens: new Map([[token.id, token]]),
    walls: new Map(),
    maps: new Map([['m1', map10]]),
    activeMapId: 'm1',
    map: map10,
    fog: { mode: 'hidden', revealed: [] },
    settings: { systemConfig: { movement: { unitsPerCell: 5 } } },
    widgetManager: { userId: '@gm:x' },
    powerLevels: { users: { '@gm:x': 50 } },
    initiative: { active: false, order: [], current_index: 0 },
  };
  sm.yjs = {
    tokensMap: { set: vi.fn((id, val) => { sm.tokens.set(id, val); }), delete: vi.fn() },
    fogMap: { set: vi.fn((_k, val) => { sm.fog = val; }), delete: vi.fn() },
  };
  return sm;
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEYS.COMBAT_AUTOMATION);
});

describe('auto_reveal_fog', () => {
  it('defaults on, so existing rooms keep the reveal they had', () => {
    expect(COMBAT_DEFAULTS.auto_reveal_fog).toBe(true);
  });

  it('reveals around a moving vision token while enabled', async () => {
    const sm = makeSm({ id: 't1', col: 2, row: 2, size: 1, vision_radius: 30 });
    await updateTokenPosition(sm, 't1', 4, 4);
    expect(sm.yjs.fogMap.set).toHaveBeenCalled();
  });

  it('reveals nothing once the GM turns it off', async () => {
    setCombatSetting('auto_reveal_fog', false);
    const sm = makeSm({ id: 't1', col: 2, row: 2, size: 1, vision_radius: 30 });
    await updateTokenPosition(sm, 't1', 4, 4);
    expect(sm.yjs.fogMap.set).not.toHaveBeenCalled();
  });

  it('still moves the token when the reveal is off', async () => {
    setCombatSetting('auto_reveal_fog', false);
    const sm = makeSm({ id: 't1', col: 2, row: 2, size: 1, vision_radius: 30 });
    await updateTokenPosition(sm, 't1', 4, 4);
    expect(sm.tokens.get('t1')).toMatchObject({ col: 4, row: 4 });
  });
});
