/**
 * Wall-drawing tool: snaps endpoints to grid, sends through state.addWall,
 * and rejects zero-length walls.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { buildWall, setupTools } from '../map/input/tools.js';

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

function mrWith(cellPx = 40) {
  return { state: { map: { cell_px: cellPx } } };
}

describe('buildWall', () => {
  it('snaps both endpoints to the nearest grid intersection', () => {
    const mr = mrWith(40);
    const w = buildWall(mr, { x: 18, y: 22 }, { x: 83, y: 77 });
    expect(w.p1).toEqual({ x: 0, y: 40 });
    expect(w.p2).toEqual({ x: 80, y: 80 });
  });

  it('defaults to blocking both sight and movement', () => {
    const mr = mrWith(40);
    const w = buildWall(mr, { x: 0, y: 0 }, { x: 40, y: 0 });
    expect(w.blocks_sight).toBe(true);
    expect(w.blocks_movement).toBe(true);
  });

  it('returns null when endpoints snap to the same cell (zero length)', () => {
    const mr = mrWith(40);
    expect(buildWall(mr, { x: 10, y: 10 }, { x: 12, y: 14 })).toBeNull();
  });

  it('returns null for missing points', () => {
    expect(buildWall(mrWith(), null, { x: 0, y: 0 })).toBeNull();
    expect(buildWall(mrWith(), { x: 0, y: 0 }, null)).toBeNull();
  });

  it('emits a unique id per call', () => {
    const mr = mrWith(40);
    const w1 = buildWall(mr, { x: 0, y: 0 }, { x: 40, y: 0 });
    const w2 = buildWall(mr, { x: 0, y: 0 }, { x: 40, y: 40 });
    expect(w1.id).toMatch(/^wall-/);
    expect(w2.id).toMatch(/^wall-/);
  });
});

function makeStageRig({ isGM }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool: 'wall',
    drawColor: '#fff', drawWidth: 2,
    state: {
      tokens: new Map(),
      drawings: [],
      walls: new Map(),
      templates: new Map(),
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      isGM: () => isGM,
      addDrawing: vi.fn().mockResolvedValue(),
      addWall: vi.fn().mockResolvedValue(),
      addTemplate: vi.fn().mockResolvedValue(),
      updateWall: vi.fn().mockResolvedValue(),
    },
    render: vi.fn(),
    _getTokenRadius: () => 15,
    setSelectedToken: vi.fn(),
  };
  return { stage, mr, container };
}

describe('wall tool finalize path', () => {
  let rig, dispose;
  afterEach(() => { dispose?.(); rig?.stage.destroy(); rig?.container.remove(); });

  it('routes through state.addWall when activeTool is wall', async () => {
    rig = makeStageRig({ isGM: true });
    dispose = setupTools(rig.mr);
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 0, clientY: 0 }, target: rig.stage });
    rig.stage._fire('mouseup', { evt: { button: 0, clientX: 80, clientY: 0 } });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.addWall).toHaveBeenCalledTimes(1);
    expect(rig.mr.state.addDrawing).not.toHaveBeenCalled();
    const sent = rig.mr.state.addWall.mock.calls[0][0];
    expect(sent.p1).toEqual({ x: 0, y: 0 });
    expect(sent.p2).toEqual({ x: 80, y: 0 });
  });

  it('does not create walls for non-GM users', async () => {
    rig = makeStageRig({ isGM: false });
    dispose = setupTools(rig.mr);
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 0, clientY: 0 }, target: rig.stage });
    rig.stage._fire('mouseup', { evt: { button: 0, clientX: 80, clientY: 0 } });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.addWall).not.toHaveBeenCalled();
  });
});
