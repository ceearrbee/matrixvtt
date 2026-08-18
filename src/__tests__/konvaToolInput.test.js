/**
 * Konva tool-input plumbing - phase 6. Stage-event handlers
 * (mousedown/move/up/click/contextmenu) are exercised in later
 * tasks; this file pins the pure stroke-builder helpers as they
 * leave Interaction.js.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Konva from 'konva';
import {
  buildStroke, buildWall, buildTemplate, setupTools,
} from '../map/input/tools.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({
    canvas: null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
  }, {
    get(t, p) { return p in t ? t[p] : () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (k) {
    if (k === '2d') { const c = make2d(); c.canvas = this; return c; }
    return orig ? orig.call(this, k) : null;
  };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});

function makeMr(overrides = {}) {
  return {
    activeTool: 'pencil',
    drawColor: '#ff00ff',
    drawWidth: 4,
    drawing: { pencilPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
    state: { map: { cell_px: 40 } },
    ...overrides,
  };
}

describe('buildStroke', () => {
  it('builds a pencil stroke from drawing.pencilPoints when none are passed', () => {
    const s = buildStroke(makeMr(), { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(s.type).toBe('pencil');
    expect(s.points.length).toBe(2);
  });

  it('builds a line', () => {
    const s = buildStroke(makeMr({ activeTool: 'line' }), { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(s).toEqual(expect.objectContaining({ type: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }));
  });
});

describe('buildWall', () => {
  it('snaps endpoints to the grid', () => {
    const w = buildWall(makeMr(), { x: 5, y: 5 }, { x: 75, y: 35 });
    expect(w.p1).toEqual({ x: 0, y: 0 });
    expect(w.p2).toEqual({ x: 80, y: 40 });
  });

  it('returns null for zero-length walls', () => {
    expect(buildWall(makeMr(), { x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe('buildTemplate', () => {
  it('builds a circle template with a 1-cell minimum radius', () => {
    const t = buildTemplate(makeMr(), { x: 40, y: 40 }, { x: 50, y: 50 });
    expect(t.shape).toBe('circle');
    expect(t.radius).toBe(1);
  });
});

function makeStageMr() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage,
    zoom: 1, panX: 0, panY: 0,
    activeTool: 'pencil',
    drawColor: '#fff', drawWidth: 2,
    selectedToken: null,
    state: {
      tokens: new Map(),
      drawings: [],
      walls: new Map(),
      templates: new Map(),
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      isGM: () => true,
      addDrawing: vi.fn().mockResolvedValue(),
      removeDrawing: vi.fn().mockResolvedValue(),
      addWall: vi.fn().mockResolvedValue(),
      addTemplate: vi.fn().mockResolvedValue(),
      updateTokenPosition: vi.fn().mockResolvedValue(),
      canMoveToken: () => true,
      updateWall: vi.fn().mockResolvedValue(),
      removeWall: vi.fn().mockResolvedValue(),
      removeTemplate: vi.fn().mockResolvedValue(),
    },
    render: vi.fn(),
    _getTokenRadius: () => 15,
    setSelectedToken: vi.fn(),
    _exitFacingMode: vi.fn(),
    broadcastPing: vi.fn(),
    showAddTokenDialog: vi.fn(),
  };
  return { stage, mr, container };
}

describe('setupTools - pencil tool', () => {
  let stage, mr, container, dispose;
  beforeEach(() => { ({ stage, mr, container } = makeStageMr()); dispose = setupTools(mr); });
  afterEach(() => { dispose?.(); stage.destroy(); container.remove(); });

  it('mousedown → mousemove → mouseup commits a pencil stroke', async () => {
    stage._fire('mousedown', { evt: { button: 0, clientX: 10, clientY: 10 }, target: stage });
    stage._fire('mousemove', { evt: { clientX: 20, clientY: 20 } });
    stage._fire('mouseup', { evt: { button: 0, clientX: 20, clientY: 20 } });
    await Promise.resolve();
    await Promise.resolve();
    expect(mr.state.addDrawing).toHaveBeenCalledTimes(1);
    expect(mr.state.addDrawing.mock.calls[0][0].type).toBe('pencil');
  });
});

describe('setupTools - pointer click selects token', () => {
  let stage, mr, container, dispose;
  beforeEach(() => {
    ({ stage, mr, container } = makeStageMr());
    mr.activeTool = 'pointer';
    mr.state.tokens.set('t1', { id: 't1', col: 1, row: 1, size: 1 });
    dispose = setupTools(mr);
  });
  afterEach(() => { dispose?.(); stage.destroy(); container.remove(); });

  it('clicking on a token calls setSelectedToken', () => {
    stage._fire('click', { evt: { clientX: 60, clientY: 60 } });
    expect(mr.setSelectedToken).toHaveBeenCalledWith('t1');
  });
});
