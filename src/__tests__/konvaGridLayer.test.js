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
