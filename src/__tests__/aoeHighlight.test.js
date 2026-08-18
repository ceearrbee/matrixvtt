/**
 * AoE highlight rendering - renderAoEHighlight
 *
 * While the GM is drawing a circle or cone tool, tokens whose centres fall
 * inside the preview area should receive a highlight ring on the canvas.
 * Tokens outside the area must NOT be highlighted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { paintAoEHighlight as renderAoEHighlight } from '../map/layers/overlays.js';
import { activeMapIdSignal } from '../state/signals.js';

function makeCtx() {
  const calls = [];
  const ctx = {
    save:    vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc:       vi.fn((...args) => calls.push(args)),
    stroke:    vi.fn(),
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalAlpha(_) {},
    _arcCalls: calls,
  };
  return ctx;
}

function makeMr({ tool, isDrawing, drawStart, drawCurrent, tokens = new Map(), cellPx = 40 }) {
  return {
    ctx: makeCtx(),
    activeTool: tool,
    drawing: { isActive: isDrawing, start: drawStart, current: drawCurrent, pencilPoints: [] },
    state: {
      tokens,
      map: { cell_px: cellPx, cell_feet: 5 },
    },
  };
}

const CELL_PX = 40;
const CELL_FT = 5;

describe('renderAoEHighlight', () => {
  beforeEach(() => {
    activeMapIdSignal.value = 'map-a';
  });
  afterEach(() => {
    activeMapIdSignal.value = null;
  });

  it('does nothing when not drawing', () => {
    const tokens = new Map([['a', { map_id: 'map-a', x: 200, y: 200 }]]);
    const mr = makeMr({ tool: 'circle', isDrawing: false, drawStart: null, drawCurrent: null, tokens });
    renderAoEHighlight(mr.ctx, mr);
    expect(mr.ctx.arc.mock.calls).toHaveLength(0);
  });

  it('does nothing for non-AoE tools', () => {
    const tokens = new Map([['a', { map_id: 'map-a', x: 200, y: 200 }]]);
    const mr = makeMr({
      tool: 'line', isDrawing: true,
      drawStart: { x: 200, y: 200 }, drawCurrent: { x: 300, y: 200 }, tokens,
    });
    renderAoEHighlight(mr.ctx, mr);
    expect(mr.ctx.arc.mock.calls).toHaveLength(0);
  });

  it('highlights tokens inside a circle preview', () => {
    // Circle centred at (200,200), radius = 80px (= 10ft at 40px/5ft = 80px)
    const tokens = new Map([
      ['inside',  { map_id: 'map-a', x: 240, y: 200 }],  // 40 px away - inside
      ['outside', { map_id: 'map-a', x: 400, y: 200 }],  // 200 px away - outside
    ]);
    const mr = makeMr({
      tool: 'circle', isDrawing: true,
      drawStart:   { x: 200, y: 200 },
      drawCurrent: { x: 280, y: 200 },  // radius = 80px
      tokens,
    });
    renderAoEHighlight(mr.ctx, mr);
    // arc() is called for drawing the highlight ring per token inside range
    const highlighted = mr.ctx._arcCalls.map(c => `${c[0]},${c[1]}`);
    expect(highlighted).toContain('240,200');
    expect(highlighted).not.toContain('400,200');
  });

  it('highlights tokens inside a cone preview', () => {
    // Cone pointing right (dx > ox), 90° arc, length = 120px
    // Origin at (200,200)
    const tokens = new Map([
      ['front', { map_id: 'map-a', x: 280, y: 200 }],   // straight ahead, in arc
      ['behind', { map_id: 'map-a', x: 100, y: 200 }],  // behind origin
    ]);
    const mr = makeMr({
      tool: 'cone', isDrawing: true,
      drawStart:   { x: 200, y: 200 },
      drawCurrent: { x: 320, y: 200 },  // points right, length = 120px
      tokens,
    });
    renderAoEHighlight(mr.ctx, mr);
    const highlighted = mr.ctx._arcCalls.map(c => `${c[0]},${c[1]}`);
    expect(highlighted).toContain('280,200');
    expect(highlighted).not.toContain('100,200');
  });
});
