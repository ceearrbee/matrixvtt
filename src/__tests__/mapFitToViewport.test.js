/**
 * Fit-to-viewport - when a map first becomes active, frame it inside
 * the stage at a sensible zoom; button-driven zoom pivots around the
 * viewport centre, not world origin. Pinned here because a stale
 * regression would put the map back in the top-left corner with the
 * "doesn't recentre on zoom" bug we just fixed.
 *
 * Also covers the tangential `_tokenImages` init bug: the bg-image
 * loader reads `mr._tokenImages.has(url)`, which throws if the cache
 * wasn't created in the constructor.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { MapRenderer } from '../map-renderer.js';
import { activeMapIdSignal, mapsSignal, tokensSignal } from '../state/signals.js';

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

function makeCanvas(w = 1000, h = 800) {
  const el = document.createElement('div');
  el.id = 'map-canvas';
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { width: w, height: h, left: 0, top: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} }
  );
  return el;
}

function makeState() {
  return {
    map: null, tokens: new Map(), fog: { mode: 'hidden', revealed: [] },
    drawings: [], initiative: { active: false, order: [], current_index: 0, round: 0 },
    isGM: () => false, userId: '@u:s',
    subscribe: vi.fn(), sendStateEvent: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  mapsSignal.value = new Map();
  activeMapIdSignal.value = null;
  tokensSignal.value = new Map();
});

afterEach(() => {
  vi.restoreAllMocks();
  mapsSignal.value = new Map();
  activeMapIdSignal.value = null;
});

describe('_tokenImages cache initialization', () => {
  it('MapRenderer constructor seeds an empty cache so getOrLoadImage does not throw', () => {
    const mr = new MapRenderer(makeCanvas(), makeState());
    expect(mr._tokenImages).toBeInstanceOf(Map);
    expect(mr._tokenImages.size).toBe(0);
    mr.destroy();
  });
});

describe('fit-to-viewport on map load', () => {
  it('centres a small map inside the viewport and zooms to fit', () => {
    // Map 500×500 px, stage 1000×800 → fit zoom = min(2, 1.6) × 0.95 = 1.52.
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 10, cell_px: 50,
    }]]);
    const mr = new MapRenderer(makeCanvas(1000, 800), makeState());
    activeMapIdSignal.value = 'm1';

    expect(mr.zoom).toBeCloseTo(1.52, 3);
    // Centred: panX = (1000 − 500 × 1.52)/2 = 120, panY = (800 − 500 × 1.52)/2 = 20.
    expect(mr.panX).toBeCloseTo(120, 1);
    expect(mr.panY).toBeCloseTo(20, 1);
    mr.destroy();
  });

  it('refits when the active map id changes', () => {
    mapsSignal.value = new Map([
      ['m1', { id: 'm1', width_cells: 10, height_cells: 10, cell_px: 50 }],
      ['m2', { id: 'm2', width_cells: 4,  height_cells: 4,  cell_px: 50 }],
    ]);
    const mr = new MapRenderer(makeCanvas(1000, 800), makeState());
    activeMapIdSignal.value = 'm1';
    const zoomA = mr.zoom;
    activeMapIdSignal.value = 'm2';
    // Smaller map fits at a much larger zoom (clamped to ZOOM_MAX = 5).
    expect(mr.zoom).toBeGreaterThan(zoomA);
    mr.destroy();
  });

  it('is a no-op when there is no active map', () => {
    const mr = new MapRenderer(makeCanvas(1000, 800), makeState());
    expect(mr.zoom).toBe(1);
    expect(mr.panX).toBe(0);
    expect(mr.panY).toBe(0);
    mr.destroy();
  });
});

describe('user framing preservation', () => {
  it('resize() refits while the user has not interacted with the viewport', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 10, cell_px: 50,
    }]]);
    const host = makeCanvas(1000, 800);
    const mr = new MapRenderer(host, makeState());
    activeMapIdSignal.value = 'm1';
    const zoomA = mr.zoom;

    host.getBoundingClientRect.mockReturnValue(
      { width: 500, height: 400, left: 0, top: 0, right: 500, bottom: 400, x: 0, y: 0, toJSON() {} },
    );
    mr.resize();
    // Half the viewport area → roughly half the fit zoom.
    expect(mr.zoom).toBeLessThan(zoomA);
    mr.destroy();
  });

  it('resize() preserves pan/zoom once the user has zoomed manually', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 10, cell_px: 50,
    }]]);
    const host = makeCanvas(1000, 800);
    const mr = new MapRenderer(host, makeState());
    activeMapIdSignal.value = 'm1';
    mr.zoomIn();
    const zoomA = mr.zoom;
    const panAX = mr.panX;
    const panAY = mr.panY;

    host.getBoundingClientRect.mockReturnValue(
      { width: 500, height: 400, left: 0, top: 0, right: 500, bottom: 400, x: 0, y: 0, toJSON() {} },
    );
    mr.resize();
    expect(mr.zoom).toBe(zoomA);
    expect(mr.panX).toBe(panAX);
    expect(mr.panY).toBe(panAY);
    mr.destroy();
  });
});

describe('button zoom pivots around viewport centre', () => {
  it('zoomIn keeps the viewport-centre world point under the centre', () => {
    const mr = new MapRenderer(makeCanvas(1000, 800), makeState());
    // Force a known starting frame: 1.0 zoom, no pan.
    mr.zoom = 1; mr.panX = 0; mr.panY = 0;

    mr.zoomIn();
    // After zoomIn (×1.2) around (500, 400): the world point under
    // viewport-centre stays at (500, 400) in screen space.
    //   world point = (mx - panX) / zoom = (500 - 0) / 1 = 500.
    //   new screen  = world * newZoom + newPanX = 500 * 1.2 + newPanX = 600 + newPanX.
    // Setting that equal to 500 gives newPanX = -100.
    expect(mr.zoom).toBeCloseTo(1.2, 3);
    expect(mr.panX).toBeCloseTo(-100, 1);
    expect(mr.panY).toBeCloseTo(-80, 1);
    mr.destroy();
  });

  it('zoomOut also pivots around viewport centre', () => {
    const mr = new MapRenderer(makeCanvas(1000, 800), makeState());
    mr.zoom = 1; mr.panX = 0; mr.panY = 0;
    mr.zoomOut();
    expect(mr.zoom).toBeCloseTo(1 / 1.2, 3);
    // newPanX = 500 - 500 * (1/1.2) ≈ 500 - 416.67 ≈ 83.33.
    expect(mr.panX).toBeCloseTo(83.33, 1);
    expect(mr.panY).toBeCloseTo(66.67, 1);
    mr.destroy();
  });
});
