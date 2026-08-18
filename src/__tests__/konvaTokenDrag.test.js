import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { enableTokenDrag } from '../map/input/token-drag.js';

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

function makeRig() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const layer = new Konva.Layer();
  stage.add(layer);
  const group = new Konva.Group({ x: 40, y: 40 });
  layer.add(group);
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    state: {
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      tokens: new Map([['t1', { id: 't1', col: 1, row: 1, size: 1 }]]),
      canMoveToken: () => true,
      updateTokenPosition: vi.fn().mockResolvedValue(),
    },
    render: vi.fn(),
    requestDragFrame: vi.fn(),
  };
  return { stage, layer, group, mr, container };
}

describe('enableTokenDrag', () => {
  let rig;
  beforeEach(() => { rig = makeRig(); });
  afterEach(() => { rig.stage.destroy(); rig.container.remove(); });

  it('marks the group draggable when canMoveToken is true', () => {
    enableTokenDrag(rig.group, rig.mr, 't1');
    expect(rig.group.draggable()).toBe(true);
  });

  it('marks the group not draggable when canMoveToken is false', () => {
    rig.mr.state.canMoveToken = () => false;
    enableTokenDrag(rig.group, rig.mr, 't1');
    expect(rig.group.draggable()).toBe(false);
  });

  it('dragend commits a single updateTokenPosition call with the new cell', () => {
    enableTokenDrag(rig.group, rig.mr, 't1');
    rig.group.position({ x: 120, y: 80 });
    rig.group.fire('dragmove', {}, true);
    rig.group.fire('dragend', {}, true);
    expect(rig.mr.state.updateTokenPosition).toHaveBeenCalledTimes(1);
    expect(rig.mr.state.updateTokenPosition).toHaveBeenCalledWith('t1', 3, 2);
  });
});
