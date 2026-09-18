/**
 * The gesture that arms the select marquee: a left drag on empty ground
 * with the pointer tool active. A drag that starts on a token belongs to
 * Konva's token drag, and a press that never moves is still a click, so
 * neither may be swallowed.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import Konva from 'konva';
import { setupTools } from '../map/input/tools.js';
import { MARQUEE_MODES } from '../utils/ui-constants.js';

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

function makeRig({ tokens = [] } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool: 'pointer',
    _spaceDown: false, isDragging: false, _pingMode: false, _facingModeTokenId: null,
    areaSelectionMode: null, areaSelectionStart: null, areaSelectionCurrent: null,
    state: {
      tokens: new Map(tokens.map((t) => [t.id, t])),
      walls: new Map(), pins: new Map(), templates: new Map(), drawings: [],
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      settings: { grid_type: 'square' },
      isGM: () => true,
      isTokenVisibleToPlayer: () => true,
    },
    render: vi.fn(),
    setSelectedToken: vi.fn(),
    setSelectedTokens: vi.fn(),
    beginSelectMarquee: vi.fn(function (x, y) {
      mr.areaSelectionMode = MARQUEE_MODES.SELECT;
      mr.areaSelectionStart = { x, y };
      mr.areaSelectionCurrent = { x, y };
    }),
    completeAreaSelection: vi.fn().mockResolvedValue(),
  };
  return { stage, mr, container };
}

const down = (stage, x, y, button = 0) =>
  stage._fire('mousedown', { evt: { button, clientX: x, clientY: y }, target: stage });
const move = (stage, x, y) =>
  stage._fire('mousemove', { evt: { clientX: x, clientY: y }, target: stage });
const up = (stage, x, y, button = 0) =>
  stage._fire('mouseup', { evt: { button, clientX: x, clientY: y }, target: stage });
const click = (stage, x, y) =>
  stage._fire('click', { evt: { clientX: x, clientY: y }, target: stage });

let rig, dispose;
afterEach(() => {
  dispose?.(); dispose = null;
  rig?.stage.destroy(); rig?.container.remove(); rig = null;
});

describe('select marquee gesture', () => {
  it('arms on a left press over empty ground', () => {
    rig = makeRig();
    dispose = setupTools(rig.mr);
    down(rig.stage, 10, 10);
    expect(rig.mr.beginSelectMarquee).toHaveBeenCalledWith(10, 10);
  });

  it('tracks the drag and commits on mouseup', async () => {
    rig = makeRig();
    dispose = setupTools(rig.mr);
    down(rig.stage, 10, 10);
    move(rig.stage, 90, 70);
    expect(rig.mr.areaSelectionCurrent).toEqual({ x: 90, y: 70 });
    await up(rig.stage, 90, 70);
    expect(rig.mr.completeAreaSelection).toHaveBeenCalled();
  });

  it('leaves a press over a token to the token drag', () => {
    rig = makeRig({ tokens: [{ id: 't1', col: 0, row: 0, size: 1 }] });
    dispose = setupTools(rig.mr);
    down(rig.stage, 20, 20);
    expect(rig.mr.beginSelectMarquee).not.toHaveBeenCalled();
  });

  it('ignores a right press', () => {
    rig = makeRig();
    dispose = setupTools(rig.mr);
    down(rig.stage, 10, 10, 2);
    expect(rig.mr.beginSelectMarquee).not.toHaveBeenCalled();
  });

  it('still clears the selection on a plain click that never dragged', async () => {
    rig = makeRig();
    dispose = setupTools(rig.mr);
    down(rig.stage, 10, 10);
    await up(rig.stage, 10, 10);
    click(rig.stage, 10, 10);
    expect(rig.mr.setSelectedToken).toHaveBeenCalledWith(null);
  });

  it('does not let the click after a real drag wipe what the drag selected', async () => {
    rig = makeRig();
    dispose = setupTools(rig.mr);
    rig.mr.completeAreaSelection = vi.fn(async () => {
      rig.mr.areaSelectionMode = null;
      rig.mr._suppressNextClick = true;
    });
    down(rig.stage, 10, 10);
    move(rig.stage, 120, 120);
    await up(rig.stage, 120, 120);
    click(rig.stage, 120, 120);
    expect(rig.mr.setSelectedToken).not.toHaveBeenCalled();
  });

  it('stays out of the way of every other tool', () => {
    rig = makeRig();
    rig.mr.activeTool = 'wall';
    dispose = setupTools(rig.mr);
    down(rig.stage, 10, 10);
    expect(rig.mr.beginSelectMarquee).not.toHaveBeenCalled();
  });
});
