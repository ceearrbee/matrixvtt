/**
 * pan-zoom module - phase 6 of the Konva migration.
 *
 * Owns wheel-zoom (at cursor, clamped), mouse-drag pan (middle-click
 * or space+drag), one-finger touch pan, and two-finger pinch zoom.
 * Listens on the Konva Stage rather than the underlying canvas.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { setupPanZoom, ZOOM_MIN, ZOOM_MAX } from '../map/input/pan-zoom.js';

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
  container.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600,
  });
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 800, height: 600 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    _isPanning: false, _spaceDown: false,
    render: vi.fn(),
  };
  return { stage, mr, container };
}

describe('pan-zoom module', () => {
  let rig, dispose;
  beforeEach(() => {
    rig = makeRig();
    dispose = setupPanZoom(rig.mr);
  });
  afterEach(() => {
    dispose?.();
    rig.stage.destroy();
    rig.container.remove();
  });

  it('wheel up zooms in, clamped at ZOOM_MAX', () => {
    rig.mr.zoom = ZOOM_MAX;
    rig.stage._fire('wheel', { evt: { deltaY: -100, clientX: 0, clientY: 0, preventDefault: () => {} } });
    expect(rig.mr.zoom).toBe(ZOOM_MAX);
  });

  it('wheel down zooms out, clamped at ZOOM_MIN', () => {
    rig.mr.zoom = ZOOM_MIN;
    rig.stage._fire('wheel', { evt: { deltaY: 100, clientX: 0, clientY: 0, preventDefault: () => {} } });
    expect(rig.mr.zoom).toBe(ZOOM_MIN);
  });

  it('wheel zoom keeps the point under the cursor fixed', () => {
    const cursorX = 200;
    const cursorY = 100;
    const worldX0 = (cursorX - rig.mr.panX) / rig.mr.zoom;
    const worldY0 = (cursorY - rig.mr.panY) / rig.mr.zoom;
    rig.stage._fire('wheel', { evt: { deltaY: -100, clientX: cursorX, clientY: cursorY, preventDefault: () => {} } });
    const worldX1 = (cursorX - rig.mr.panX) / rig.mr.zoom;
    const worldY1 = (cursorY - rig.mr.panY) / rig.mr.zoom;
    expect(worldX1).toBeCloseTo(worldX0);
    expect(worldY1).toBeCloseTo(worldY0);
  });

  it('wheel calls render()', () => {
    rig.stage._fire('wheel', { evt: { deltaY: -100, clientX: 0, clientY: 0, preventDefault: () => {} } });
    expect(rig.mr.render).toHaveBeenCalled();
  });

  it('middle-click drag starts a pan, moves, ends on mouseup', () => {
    rig.stage._fire('mousedown', { evt: { button: 1, clientX: 100, clientY: 100, preventDefault: () => {} } });
    expect(rig.mr._isPanning).toBe(true);
    rig.stage._fire('mousemove', { evt: { button: 1, clientX: 150, clientY: 120 } });
    expect(rig.mr.panX).toBe(50);
    expect(rig.mr.panY).toBe(20);
    rig.stage._fire('mouseup', { evt: { button: 1 } });
    expect(rig.mr._isPanning).toBe(false);
  });

  it('space+drag (left button with spaceDown) pans', () => {
    rig.mr._spaceDown = true;
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 100, clientY: 100, preventDefault: () => {} } });
    expect(rig.mr._isPanning).toBe(true);
    rig.stage._fire('mousemove', { evt: { button: 0, clientX: 110, clientY: 115 } });
    expect(rig.mr.panX).toBe(10);
    expect(rig.mr.panY).toBe(15);
  });

  it('left-click without space does not start pan', () => {
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 0, clientY: 0, preventDefault: () => {} } });
    expect(rig.mr._isPanning).toBe(false);
  });
});
