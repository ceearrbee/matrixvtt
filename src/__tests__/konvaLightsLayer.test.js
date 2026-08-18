/**
 * Konva lights layer.
 *
 * Renders one radial-gradient circle per light source, visible to all
 * roles. Diffs against `lightsSignal`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { lightsSignal, activeMapIdSignal, mapsSignal } from '../state/signals.js';
import { createLightsLayer } from '../map/layers/lights.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2dCtx = () => {
    const base = {
      canvas: null, fillStyle: '', strokeStyle: '',
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

describe('createLightsLayer', () => {
  let stage;
  let dispose;
  let circles;

  let layer;

  beforeEach(() => {
    lightsSignal.value = new Map();
    mapsSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ layer, circles, dispose } = createLightsLayer(stage, {}));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    lightsSignal.value = new Map();
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders a circle for each light source', () => {
    lightsSignal.value = new Map([
      ['l1', { id: 'l1', map_id: 'map-a', x: 100, y: 100, radius_px: 80 }],
      ['l2', { id: 'l2', map_id: 'map-a', x: 200, y: 200, radius_px: 60, color: 'ffaa00ff', intensity: 0.4 }],
    ]);
    expect(circles.size).toBe(2);
    expect(circles.get('l1').radius()).toBe(80);
    expect(circles.get('l2').radius()).toBe(60);
  });

  it('skips lights with malformed coordinates or non-positive radius', () => {
    lightsSignal.value = new Map([
      ['ok', { id: 'ok', map_id: 'map-a', x: 0, y: 0, radius_px: 50 }],
      ['bad-radius', { id: 'bad-radius', map_id: 'map-a', x: 0, y: 0, radius_px: 0 }],
      ['no-x', { id: 'no-x', map_id: 'map-a', y: 0, radius_px: 50 }],
    ]);
    expect(circles.size).toBe(1);
    expect(circles.has('ok')).toBe(true);
  });

  it('removes circles when lights are deleted', () => {
    lightsSignal.value = new Map([
      ['l1', { id: 'l1', map_id: 'map-a', x: 0, y: 0, radius_px: 50 }],
      ['l2', { id: 'l2', map_id: 'map-a', x: 10, y: 10, radius_px: 40 }],
    ]);
    expect(circles.size).toBe(2);
    lightsSignal.value = new Map([['l1', { id: 'l1', map_id: 'map-a', x: 0, y: 0, radius_px: 50 }]]);
    expect(circles.size).toBe(1);
  });

  it('renders only lights whose map_id matches activeMapId', () => {
    lightsSignal.value = new Map([
      ['l1', { id: 'l1', map_id: 'map-a', x: 0, y: 0, radius_px: 50 }],
      ['l2', { id: 'l2', map_id: 'map-b', x: 0, y: 0, radius_px: 50 }],
    ]);
    expect(circles.size).toBe(1);
    expect(circles.has('l1')).toBe(true);
  });

  it('hides previous-map lights after activeMapId changes', () => {
    lightsSignal.value = new Map([
      ['l1', { id: 'l1', map_id: 'map-a', x: 0, y: 0, radius_px: 50 }],
    ]);
    expect(circles.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(circles.size).toBe(0);
  });

  it('clips the layer to the active map rect once map data hydrates', () => {
    // Pre-hydrate state: map data hasn't arrived yet. clipFunc should
    // be null so the layer renders unclipped (Konva treats null
    // clipFunc as "no clip applied").
    lightsSignal.value = new Map([
      ['l1', { id: 'l1', map_id: 'map-a', x: 100, y: 420, radius_px: 100 }],
    ]);
    expect(layer.clipFunc()).toBeFalsy();

    // Map hydrates: clipFunc set to a function that paints the map
    // rect. Exercise it against a mock canvas context to verify it
    // produces a rect at the map's dimensions.
    mapsSignal.value = new Map([
      ['map-a', { id: 'map-a', width_cells: 8, height_cells: 11, cell_px: 40 }],
    ]);
    const fn = layer.clipFunc();
    expect(typeof fn).toBe('function');
    const calls = [];
    fn({ rect: (...args) => calls.push(['rect', ...args]) });
    expect(calls).toEqual([['rect', 0, 0, 8 * 40, 11 * 40]]);
  });

  it('updates the clipFunc when the active map switches', () => {
    mapsSignal.value = new Map([
      ['map-a', { id: 'map-a', width_cells: 8, height_cells: 11, cell_px: 40 }],
      ['map-b', { id: 'map-b', width_cells: 12, height_cells: 12, cell_px: 50 }],
    ]);
    const callsA = [];
    layer.clipFunc()({ rect: (...args) => callsA.push(args) });
    expect(callsA).toEqual([[0, 0, 8 * 40, 11 * 40]]);

    activeMapIdSignal.value = 'map-b';
    const callsB = [];
    layer.clipFunc()({ rect: (...args) => callsB.push(args) });
    expect(callsB).toEqual([[0, 0, 12 * 50, 12 * 50]]);
  });
});
