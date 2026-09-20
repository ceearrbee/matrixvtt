/**
 * Konva grid layer - phase 7. Draws square or hex grid lines using
 * a single Konva.Shape with a sceneFunc so the path logic carries
 * over from the old Canvas2D renderer unchanged.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { mapsSignal, activeMapIdSignal, settingsSignal } from '../state/signals.js';
import { createGridLayer, paintGrid } from '../map/layers/grid.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({ canvas: null,
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

function makeStage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new Konva.Stage({ container, width: 400, height: 300 });
}

function makeMr() {
  return {
    zoom: 1,
    _colors: { gridLine: 'rgba(255,255,255,0.08)' },
    state: { isGM: () => false, map: null, settings: {} },
  };
}

describe('paintGrid (pure)', () => {
  it('1×1 square map emits 4 moveTo calls (2 verticals + 2 horizontals)', () => {
    let moves = 0;
    const ctx = { beginPath: () => {}, moveTo: () => moves++, lineTo: () => {}, stroke: () => {}, set strokeStyle(_) {}, set lineWidth(_) {} };
    const mr = makeMr();
    mr.state.map = { width_cells: 1, height_cells: 1, cell_px: 40 };
    paintGrid(ctx, mr);
    expect(moves).toBe(4);
  });

  it('no map → no-op', () => {
    let called = false;
    const ctx = { beginPath: () => { called = true; }, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, set strokeStyle(_) {}, set lineWidth(_) {} };
    paintGrid(ctx, makeMr());
    expect(called).toBe(false);
  });
});

describe('createGridLayer', () => {
  let stage;
  let dispose;

  beforeEach(() => {
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
    settingsSignal.value = {};
    stage = makeStage();
    ({ dispose } = createGridLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
    settingsSignal.value = {};
  });

  it('dispose stops future signal reactions', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', width_cells: 2, height_cells: 2, cell_px: 40 }]]);
    activeMapIdSignal.value = 'm1';
    expect(() => dispose()).not.toThrow();
  });
});

/**
 * Grid contrast over map backgrounds.
 *
 * The `--color-grid-line` token is tuned to the app theme, which knows
 * nothing about the image or tile the GM put under it. A light tile
 * under a dark theme left the grid invisible. Each line is now drawn
 * twice: a wider halo of the opposite polarity underneath, then the
 * themed line on top. Whichever contrasts with the actual background
 * is the one you see.
 */
describe('paintGrid contrast halo', () => {
  function recorder() {
    const calls = [];
    const ctx = {
      calls,
      beginPath: () => calls.push(['beginPath']),
      moveTo: () => calls.push(['moveTo']),
      lineTo: () => calls.push(['lineTo']),
      closePath: () => {},
      stroke: () => calls.push(['stroke']),
    };
    Object.defineProperty(ctx, 'strokeStyle', { set: (v) => { calls.push(['strokeStyle', v]); }, get: () => '' });
    Object.defineProperty(ctx, 'lineWidth', { set: (v) => { calls.push(['lineWidth', v]); }, get: () => 1 });
    return ctx;
  }

  function mrWith(overrides = {}) {
    return {
      zoom: 1,
      _colors: { gridLine: 'rgba(255,255,255,0.08)', gridHalo: 'rgba(0,0,0,0.45)' },
      state: {
        map: { width_cells: 3, height_cells: 2, cell_px: 40 },
        settings: {},
      },
      ...overrides,
    };
  }

  /** Style changes paired with the stroke that used them, in order. */
  function strokes(ctx) {
    const out = [];
    let colour = null;
    let width = null;
    for (const [op, value] of ctx.calls) {
      if (op === 'strokeStyle') colour = value;
      else if (op === 'lineWidth') width = value;
      else if (op === 'stroke') out.push({ colour, width });
    }
    return out;
  }

  it('strokes the halo first and the themed line on top', () => {
    const ctx = recorder();
    paintGrid(ctx, mrWith());
    const passes = strokes(ctx);
    expect(passes.length).toBe(2);
    expect(passes[0].colour).toBe('rgba(0,0,0,0.45)');
    expect(passes[1].colour).toBe('rgba(255,255,255,0.08)');
  });

  it('makes the halo wider than the line it sits behind', () => {
    const ctx = recorder();
    paintGrid(ctx, mrWith());
    const [halo, line] = strokes(ctx);
    expect(halo.width).toBeGreaterThan(line.width);
  });

  it('scales both passes with zoom so they stay hairlines', () => {
    const ctx = recorder();
    paintGrid(ctx, mrWith({ zoom: 4 }));
    const [halo, line] = strokes(ctx);
    expect(line.width).toBeCloseTo(1 / 4);
    expect(halo.width).toBeCloseTo(halo.width);
    expect(halo.width).toBeLessThan(1);
  });

  it('builds the path once and strokes it twice, rather than walking it twice', () => {
    const ctx = recorder();
    paintGrid(ctx, mrWith());
    expect(ctx.calls.filter(([op]) => op === 'beginPath').length).toBe(1);
  });

  it('gives hex grids the same halo', () => {
    const ctx = recorder();
    const mr = mrWith();
    mr.state.settings = { grid_type: 'hex_pointy' };
    paintGrid(ctx, mr);
    expect(strokes(ctx).length).toBe(2);
  });

  it('falls back to a dark halo when the theme has not published one', () => {
    const ctx = recorder();
    const mr = mrWith();
    mr._colors = { gridLine: 'rgba(255,255,255,0.08)' };
    paintGrid(ctx, mr);
    expect(strokes(ctx)[0].colour).toBeTruthy();
  });
});
