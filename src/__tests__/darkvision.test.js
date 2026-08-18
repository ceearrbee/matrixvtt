/**
 * Darkvision tint (§30): render pass paints blue annulus between
 * vision_radius and darkvision_radius, and fog auto-reveal uses the
 * greater of the two radii.
 */

import { describe, it, expect, vi } from 'vitest';
import { paintVision as renderVisionMask } from '../map/layers/fog.js';
import { updateTokenPosition } from '../state/writer.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeCtx() {
  const calls = [];
  return {
    calls,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(() => calls.push(['beginPath'])),
    rect: vi.fn((...a) => calls.push(['rect', ...a])),
    moveTo: vi.fn((...a) => calls.push(['moveTo', ...a])),
    arc: vi.fn((...a) => calls.push(['arc', ...a])),
    lineTo: vi.fn((...a) => calls.push(['lineTo', ...a])),
    closePath: vi.fn(() => calls.push(['closePath'])),
    fill: vi.fn((rule) => calls.push(['fill', rule, this?.fillStyle])),
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    get fillStyle() { return calls.filter((c) => c[0] === 'fillStyle').slice(-1)[0]?.[1]; },
  };
}

function makeMr({ tokens = [], walls = [] }) {
  const tokenMap = new Map();
  for (const t of tokens) tokenMap.set(t.id, t);
  const wallMap = new Map();
  for (const w of walls) wallMap.set(w.id, w);
  return {
    ctx: makeCtx(),
    zoom: 1,
    state: {
      map: { width_cells: 10, height_cells: 10, cell_px: 40 },
      tokens: tokenMap,
      walls: wallMap,
      isGM: () => false,
      widgetManager: { userId: '@me:x' },
      settings: { systemConfig: { movement: { unitsPerCell: 5 } } },
    },
  };
}

describe('renderVisionMask darkvision tint', () => {
  it('emits both dark-fill and darkvision-tint fills when dark > bright', () => {
    const mr = makeMr({
      tokens: [{ id: 't1', col: 5, row: 5, size: 1, vision_radius: 30, darkvision_radius: 60 }],
    });
    renderVisionMask(mr.ctx, mr);
    const fills = mr.ctx.calls.filter((c) => c[0] === 'fillStyle').map((c) => c[1]);
    expect(fills).toContain('rgba(0, 0, 0, 0.85)');
    expect(fills).toContain('rgba(70, 110, 160, 0.45)');
  });

  it('skips the tint pass when darkvision does not exceed vision', () => {
    const mr = makeMr({
      tokens: [{ id: 't1', col: 5, row: 5, size: 1, vision_radius: 60 }],
    });
    renderVisionMask(mr.ctx, mr);
    const fills = mr.ctx.calls.filter((c) => c[0] === 'fillStyle').map((c) => c[1]);
    expect(fills).toContain('rgba(0, 0, 0, 0.85)');
    expect(fills).not.toContain('rgba(70, 110, 160, 0.45)');
  });

  it('skips entirely when token has no vision at all', () => {
    const mr = makeMr({ tokens: [{ id: 't1', col: 5, row: 5, size: 1 }] });
    renderVisionMask(mr.ctx, mr);
    expect(mr.ctx.calls.length).toBe(0);
  });

  it('draws an annulus (outer arc + reverse inner arc) for darkvision pass', () => {
    const mr = makeMr({
      tokens: [{ id: 't1', col: 5, row: 5, size: 1, vision_radius: 30, darkvision_radius: 60 }],
    });
    renderVisionMask(mr.ctx, mr);
    // arc signature: (x, y, radius, startAngle, endAngle, anticlockwise?)
    const arcs = mr.ctx.calls.filter((c) => c[0] === 'arc');
    // Radii are scaled to pixels via (radius / unitsPerCell) * cell_px,
    // so vision=30 → 240 px and darkvision=60 → 480 px (cell_px=40, ft/cell=5).
    const outerArc = arcs.find((c) => c[3] === 480 && c[6] !== true);
    const reverseArc = arcs.find((c) => c[6] === true);
    expect(outerArc).toBeDefined();
    expect(reverseArc).toBeDefined();
    expect(reverseArc[3]).toBe(240);
  });
});

describe('fog auto-reveal uses max(vision, darkvision)', () => {
  function smGM(token) {
    const sm = {
      tokens: new Map([[token.id, token]]),
      walls: new Map(),
      maps: new Map([['m', { width_cells: 10, height_cells: 10, cell_px: 40 }]]),
      activeMapId: 'm',
      map: { width_cells: 10, height_cells: 10, cell_px: 40 },
      fog: { mode: 'hidden', revealed: [] },
      settings: { systemConfig: { movement: { unitsPerCell: 5 } } },
      powerLevels: { users: { '@gm:x': 50 } },
      widgetManager: { userId: '@gm:x' },
      initiative: { active: false, order: [], current_index: 0 },
      sendStateEvent: vi.fn().mockResolvedValue(undefined),
    };
    sm.yjs = {
      tokensMap: {
        set: vi.fn((id, val) => sm.tokens.set(id, val)),
        delete: vi.fn((id) => sm.tokens.delete(id)),
      },
      fogMap: {
        set: vi.fn((_k, val) => { sm.fog = val; }),
        delete: vi.fn(),
      },
    };
    return sm;
  }

  it('reveals out to darkvision when it exceeds vision_radius', async () => {
    const sm = smGM({ id: 't1', col: 2, row: 2, size: 1, vision_radius: 10, darkvision_radius: 30 });
    await updateTokenPosition(sm, 't1', 3, 3);
    expect(sm.yjs.fogMap.set).toHaveBeenCalled();
    expect(sm.fog.revealed).toContain('8,3');
  });

  it('does not auto-reveal when both radii are zero/absent', async () => {
    const sm = smGM({ id: 't1', col: 2, row: 2, size: 1 });
    await updateTokenPosition(sm, 't1', 3, 3);
    expect(sm.yjs.fogMap.set).not.toHaveBeenCalled();
  });
});
