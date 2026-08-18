/**
 * Touch support - phase 6 of the Konva migration. One-finger pan and
 * two-finger pinch zoom flow through `setupPanZoom` on the Konva
 * Stage; this test fires `touchstart`/`touchmove`/`touchend` Stage
 * events and checks the resulting `mr.panX/panY/zoom`.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { setupPanZoom } from '../map/input/pan-zoom.js';

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

function touch(x, y) { return { clientX: x, clientY: y }; }

describe('one-finger touch pan', () => {
  let rig, dispose;
  beforeEach(() => { rig = makeRig(); dispose = setupPanZoom(rig.mr); });
  afterEach(() => { dispose?.(); rig.stage.destroy(); rig.container.remove(); });

  it('translates pan by the delta between touchstart and touchmove', () => {
    rig.stage._fire('touchstart', { evt: { touches: [touch(80, 160)] } });
    rig.stage._fire('touchmove', { evt: { touches: [touch(100, 200)] } });
    expect(rig.mr.panX).toBe(20);
    expect(rig.mr.panY).toBe(40);
  });

  it('stops panning after touchend', () => {
    rig.stage._fire('touchstart', { evt: { touches: [touch(80, 160)] } });
    rig.stage._fire('touchend', { evt: { touches: [] } });
    rig.stage._fire('touchmove', { evt: { touches: [touch(200, 300)] } });
    expect(rig.mr.panX).toBe(0);
    expect(rig.mr.panY).toBe(0);
  });
});

describe('two-finger pinch zoom', () => {
  let rig, dispose;
  beforeEach(() => { rig = makeRig(); dispose = setupPanZoom(rig.mr); });
  afterEach(() => { dispose?.(); rig.stage.destroy(); rig.container.remove(); });

  it('doubling the touch distance doubles the zoom', () => {
    rig.stage._fire('touchstart', { evt: { touches: [touch(0, 0), touch(100, 0)] } });
    rig.stage._fire('touchmove', { evt: { touches: [touch(0, 0), touch(200, 0)] } });
    expect(rig.mr.zoom).toBeCloseTo(2, 5);
  });
});
