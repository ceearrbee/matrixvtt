/**
 * Vision-aware fog reveal (§30): walls cut LOS; movement auto-reveals.
 */

import { describe, it, expect, vi } from 'vitest';
import { revealFogAroundToken, updateTokenPosition } from '../state/writer.js';
import { segmentsIntersect, segmentBlockedByWalls } from '../utils/geometry.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeSm({ walls = [], token, map } = {}) {
  const wallMap = new Map();
  for (const w of walls) wallMap.set(w.id, w);
  const tokenMap = new Map();
  if (token) tokenMap.set(token.id, token);
  const sm = {
    tokens: tokenMap,
    walls: wallMap,
    maps: new Map([['m1', map]]),
    activeMapId: 'm1',
    map,
    fog: { mode: 'hidden', revealed: [] },
    settings: { systemConfig: { movement: { unitsPerCell: 5 } } },
    // The fogMap mock mirrors writes back into sm.fog so the assertions
    // below see the bridge-side effect that production gets from
    // YjsSignalBridge.
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
    widgetManager: { userId: '@gm:x' },
    initiative: { active: false, order: [], current_index: 0 },
  };
  sm.yjs = {
    tokensMap: {
      set: vi.fn((id, val) => { sm.tokens.set(id, val); }),
      delete: vi.fn((id) => sm.tokens.delete(id)),
    },
    fogMap: {
      set: vi.fn((_k, val) => { sm.fog = val; }),
      delete: vi.fn(),
    },
  };
  return sm;
}
function withGM(sm) {
  sm.powerLevels = { users: { '@gm:x': 50 } };
  return sm;
}

const map10 = { width_cells: 10, height_cells: 10, cell_px: 40 };

describe('segmentsIntersect', () => {
  it('detects crossing segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });
  it('rejects parallel non-overlapping', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });
  it('rejects disjoint skew', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false);
  });
});

describe('segmentBlockedByWalls', () => {
  const wall = { id: 'w', p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 }, blocks_sight: true };
  it('returns true when sight wall crosses the ray', () => {
    expect(segmentBlockedByWalls({ x: 0, y: 100 }, { x: 200, y: 100 }, [wall])).toBe(true);
  });
  it('ignores walls with blocks_sight=false', () => {
    expect(segmentBlockedByWalls({ x: 0, y: 100 }, { x: 200, y: 100 }, [{ ...wall, blocks_sight: false }])).toBe(false);
  });
});

describe('revealFogAroundToken with walls', () => {
  it('reveals a full circle when no walls present', async () => {
    const token = { id: 't1', col: 5, row: 5, size: 1 };
    const sm = makeSm({ token, map: map10 });
    await revealFogAroundToken(sm, 't1', 10);
    expect(sm.fog.revealed.length).toBeGreaterThan(0);
    expect(sm.fog.revealed).toContain('5,5');
  });

  it('skips cells on the far side of a sight-blocking wall', async () => {
    const token = { id: 't1', col: 2, row: 5, size: 1 };
    // Vertical wall between col=4 and col=5 (at px x=200), spanning whole height.
    const wall = {
      id: 'w', p1: { x: 200, y: 0 }, p2: { x: 200, y: 400 },
      blocks_sight: true,
    };
    const sm = makeSm({ token, walls: [wall], map: map10 });
    await revealFogAroundToken(sm, 't1', 25);
    // Near side (same side as token at col 2–4) should be revealed.
    expect(sm.fog.revealed).toContain('3,5');
    // Far side (past the wall) should not be revealed.
    expect(sm.fog.revealed).not.toContain('6,5');
    expect(sm.fog.revealed).not.toContain('7,5');
  });

  it('ignores non-sight-blocking walls', async () => {
    const token = { id: 't1', col: 2, row: 5, size: 1 };
    const wall = {
      id: 'w', p1: { x: 200, y: 0 }, p2: { x: 200, y: 400 },
      blocks_sight: false,
    };
    const sm = makeSm({ token, walls: [wall], map: map10 });
    await revealFogAroundToken(sm, 't1', 25);
    expect(sm.fog.revealed).toContain('6,5');
  });
});

describe('updateTokenPosition auto-reveals for vision tokens', () => {
  it('calls revealFogAroundToken when token has vision_radius (writes via yjs.fogMap)', async () => {
    const token = { id: 't1', col: 2, row: 2, size: 1, vision_radius: 30 };
    const sm = withGM(makeSm({ token, map: map10 }));
    await updateTokenPosition(sm, 't1', 4, 4);
    expect(sm.yjs.fogMap.set).toHaveBeenCalled();
  });

  it('does not auto-reveal for tokens without vision_radius', async () => {
    const token = { id: 't1', col: 2, row: 2, size: 1 };
    const sm = withGM(makeSm({ token, map: map10 }));
    await updateTokenPosition(sm, 't1', 4, 4);
    expect(sm.yjs.fogMap.set).not.toHaveBeenCalled();
  });
});
