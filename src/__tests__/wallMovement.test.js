/**
 * Walls with `blocks_movement: true` reject straight-line token moves
 * that would cross them. `blocks_movement: false` does not.
 */

import { describe, it, expect, vi } from 'vitest';
import { updateTokenPosition } from '../state/writer.js';

function makeSm({ token, walls = [] }) {
  const tokens = new Map([[token.id, token]]);
  const wallMap = new Map();
  for (const w of walls) wallMap.set(w.id, w);
  return {
    tokens,
    walls: wallMap,
    maps: new Map([['m', { width_cells: 10, height_cells: 10, cell_px: 40 }]]),
    activeMapId: 'm',
    map: { width_cells: 10, height_cells: 10, cell_px: 40 },
    fog: { mode: 'hidden', revealed: [] },
    settings: { systemConfig: { movement: { unitsPerCell: 5 } } },
    powerLevels: { users: { '@gm:x': 50 } },
    widgetManager: { userId: '@gm:x' },
    initiative: { active: false, order: [], current_index: 0 },
    yjs: { tokensMap: { set: vi.fn(), delete: vi.fn() }, fogMap: { set: vi.fn() } },
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
  };
}

// Vertical wall between col=4 and col=5 (at px x=200), spanning whole height.
const blockerWall = {
  id: 'w', p1: { x: 200, y: 0 }, p2: { x: 200, y: 400 },
  blocks_movement: true, blocks_sight: false,
};

describe('updateTokenPosition wall enforcement', () => {
  it('rejects a move whose path crosses a blocks_movement wall', async () => {
    const sm = makeSm({
      token: { id: 't1', col: 2, row: 5, size: 1 },
      walls: [blockerWall],
    });
    await expect(updateTokenPosition(sm, 't1', 7, 5)).rejects.toThrow(/Blocked/);
    expect(sm.tokens.get('t1').col).toBe(2);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('allows moves that stay on the same side of the wall', async () => {
    const sm = makeSm({
      token: { id: 't1', col: 1, row: 5, size: 1 },
      walls: [blockerWall],
    });
    await expect(updateTokenPosition(sm, 't1', 3, 5)).resolves.toBeUndefined();
    expect(sm.yjs.tokensMap.set.mock.calls[0][1]).toMatchObject({ col: 3 });
  });

  it('ignores walls with blocks_movement=false', async () => {
    const sm = makeSm({
      token: { id: 't1', col: 2, row: 5, size: 1 },
      walls: [{ ...blockerWall, blocks_movement: false }],
    });
    await expect(updateTokenPosition(sm, 't1', 7, 5)).resolves.toBeUndefined();
    expect(sm.yjs.tokensMap.set.mock.calls[0][1]).toMatchObject({ col: 7 });
  });

  it('allows setting the same position (no-op)', async () => {
    const sm = makeSm({
      token: { id: 't1', col: 2, row: 5, size: 1 },
      walls: [blockerWall],
    });
    await expect(updateTokenPosition(sm, 't1', 2, 5)).resolves.toBeUndefined();
  });
});
