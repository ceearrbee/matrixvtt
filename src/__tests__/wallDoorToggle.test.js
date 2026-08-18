/**
 * Door toggle: clicking an existing wall with the wall tool active
 * flips blocks_sight, keeping blocks_movement untouched.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import Konva from 'konva';
import { setupTools, strokeIsActive } from '../map/input/tools.js';

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

function makeRig({ isGM = true, wall } = {}) {
  const walls = new Map();
  if (wall) walls.set(wall.id, wall);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool: 'wall',
    drawColor: '#fff', drawWidth: 2,
    _spaceDown: false,
    state: {
      tokens: new Map(),
      drawings: [],
      walls,
      templates: new Map(),
      map: { cell_px: 40 },
      isGM: () => isGM,
      updateWall: vi.fn().mockResolvedValue(undefined),
      addWall: vi.fn().mockResolvedValue(undefined),
      addDrawing: vi.fn().mockResolvedValue(undefined),
      addTemplate: vi.fn().mockResolvedValue(undefined),
    },
    render: vi.fn(),
    _getTokenRadius: () => 15,
  };
  const dispose = setupTools(mr);
  return { stage, mr, container, dispose };
}

const solidWall = {
  id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 },
  blocks_sight: true, blocks_movement: true,
};

describe('wall tool click-on-wall toggles door', () => {
  let rig;
  afterEach(() => { rig?.dispose(); rig?.stage.destroy(); rig?.container.remove(); });

  it('flips blocks_sight on a solid wall (closes → opens)', async () => {
    rig = makeRig({ wall: solidWall });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 2 }, target: rig.stage });
    await Promise.resolve();
    expect(rig.mr.state.updateWall).toHaveBeenCalledWith('w1', { blocks_sight: false });
    expect(strokeIsActive()).toBe(false);
  });

  it('flips blocks_sight on an open door (opens → closes)', async () => {
    rig = makeRig({ wall: { ...solidWall, blocks_sight: false } });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 2 }, target: rig.stage });
    await Promise.resolve();
    expect(rig.mr.state.updateWall).toHaveBeenCalledWith('w1', { blocks_sight: true });
  });

  it('does not toggle for non-GM users', async () => {
    rig = makeRig({ isGM: false, wall: solidWall });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 50, clientY: 2 }, target: rig.stage });
    await Promise.resolve();
    expect(rig.mr.state.updateWall).not.toHaveBeenCalled();
  });

  it('starts a new wall drag when click lands away from any wall', async () => {
    rig = makeRig({ wall: solidWall });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 500, clientY: 500 }, target: rig.stage });
    expect(rig.mr.state.updateWall).not.toHaveBeenCalled();
    expect(strokeIsActive()).toBe(true);
  });
});
