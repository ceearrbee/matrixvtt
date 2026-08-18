/**
 * Erase tool removes walls under the cursor (GM-only).
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import Konva from 'konva';
import { setupTools } from '../map/input/tools.js';

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

function makeRig({ isGM = true, walls = [], drawings = [] } = {}) {
  const wallMap = new Map();
  for (const w of walls) wallMap.set(w.id, w);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool: 'erase',
    _spaceDown: false,
    state: {
      drawings,
      walls: wallMap,
      templates: new Map(),
      tokens: new Map(),
      map: { cell_px: 40 },
      isGM: () => isGM,
      removeDrawing: vi.fn().mockResolvedValue(undefined),
      removeWall: vi.fn().mockResolvedValue(undefined),
      removeTemplate: vi.fn().mockResolvedValue(undefined),
    },
    render: vi.fn(),
    _getTokenRadius: () => 15,
  };
  const dispose = setupTools(mr);
  return { stage, mr, container, dispose };
}

const wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } };

describe('erase tool + walls', () => {
  let rig;
  afterEach(() => { rig?.dispose(); rig?.stage.destroy(); rig?.container.remove(); });

  it('GM erase-click near a wall removes it', async () => {
    rig = makeRig({ walls: [wall] });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 2 }, target: rig.stage });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.removeWall).toHaveBeenCalledWith('w1');
  });

  it('GM erase-click far from any wall does nothing', async () => {
    rig = makeRig({ walls: [wall] });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 500, clientY: 500 }, target: rig.stage });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.removeWall).not.toHaveBeenCalled();
  });

  it('non-GM cannot erase walls', async () => {
    rig = makeRig({ isGM: false, walls: [wall] });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 2 }, target: rig.stage });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.removeWall).not.toHaveBeenCalled();
  });

  it('drawings take priority over walls when both overlap', async () => {
    const stroke = { id: 'd1', type: 'line', width: 3, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    rig = makeRig({ walls: [wall], drawings: [stroke] });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 1 }, target: rig.stage });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.removeDrawing).toHaveBeenCalledWith('d1');
    expect(rig.mr.state.removeWall).not.toHaveBeenCalled();
  });
});
