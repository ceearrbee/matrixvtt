/**
 * Konva drawings layer - phase 4 of the Konva migration.
 *
 * `createDrawingsLayer(stage, mr)` keeps one Konva shape per committed
 * stroke in `drawingsSignal`, plus a transient preview shape for
 * in-progress strokes driven by `mr.drawing`. Diff-on-write replaces
 * the per-frame Canvas2D pass in `render/overlays.js`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { drawingsSignal, activeMapIdSignal } from '../state/signals.js';
import { createDrawingsLayer } from '../map/layers/drawings.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2dCtx = () => {
    const base = {
      canvas: null, fillStyle: '', strokeStyle: '', font: '',
      globalAlpha: 1, lineWidth: 1, textAlign: '', textBaseline: '',
      shadowColor: '', shadowBlur: 0, lineCap: '', lineJoin: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      measureText: () => ({ width: 0 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => ({}),
    };
    return new Proxy(base, {
      get(target, prop) { return prop in target ? target[prop] : () => undefined; },
      set(target, prop, value) { target[prop] = value; return true; },
    });
  };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') { const ctx = make2dCtx(); ctx.canvas = this; return ctx; }
    return orig ? orig.call(this, kind) : null;
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
    drawing: { isActive: false, start: null, current: null },
    _buildStroke: () => null,
    activeTool: 'pointer',
  };
}

describe('createDrawingsLayer', () => {
  let stage;
  let dispose;
  let layer;
  let shapes;

  beforeEach(() => {
    drawingsSignal.value = [];
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ layer, shapes, dispose } = createDrawingsLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    drawingsSignal.value = [];
    activeMapIdSignal.value = null;
  });

  it('renders a Line for a pencil stroke', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'pencil', color: '#f00', width: 2,
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
    ];
    expect(shapes.size).toBe(1);
    expect(shapes.get('d1').points()).toEqual([0, 0, 10, 10]);
  });

  it('renders a Rect for a rect stroke', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'rect', color: '#0f0', width: 2, x: 5, y: 5, w: 20, h: 10 },
    ];
    expect(shapes.size).toBe(1);
    expect(shapes.get('d1')).toBeInstanceOf(Konva.Rect);
  });

  it('renders a Circle for a circle stroke', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'circle', color: '#00f', width: 2, x: 50, y: 50, r: 20 },
    ];
    expect(shapes.size).toBe(1);
    expect(shapes.get('d1')).toBeInstanceOf(Konva.Circle);
  });

  it('removes shapes when the signal shrinks', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'rect', color: '#f00', width: 2, x: 0, y: 0, w: 10, h: 10 },
      { id: 'd2', map_id: 'map-a', type: 'circle', color: '#f00', width: 2, x: 0, y: 0, r: 5 },
    ];
    expect(shapes.size).toBe(2);
    drawingsSignal.value = [drawingsSignal.value[0]];
    expect(shapes.size).toBe(1);
    expect(shapes.has('d2')).toBe(false);
  });

  it('dispose stops further signal-driven updates', () => {
    drawingsSignal.value = [{ id: 'd1', map_id: 'map-a', type: 'rect', color: '#f00', width: 2, x: 0, y: 0, w: 10, h: 10 }];
    dispose();
    drawingsSignal.value = [];
    expect(shapes.size).toBe(1);
  });

  it('renders only drawings whose map_id matches activeMapId', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'pencil', color: '#f00', width: 2, points: [] },
      { id: 'd2', map_id: 'map-b', type: 'pencil', color: '#0f0', width: 2, points: [] },
    ];
    expect(shapes.size).toBe(1);
    expect(shapes.has('d1')).toBe(true);
  });

  it('hides previous-map drawings after activeMapId changes', () => {
    drawingsSignal.value = [
      { id: 'd1', map_id: 'map-a', type: 'pencil', color: '#f00', width: 2, points: [] },
    ];
    expect(shapes.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(shapes.size).toBe(0);
  });
});
