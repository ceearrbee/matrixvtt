/**
 * Konva environment-tint layer - phase 7.
 *
 * Cosmetic tint derived from settings.environment via
 * utils/environmentTint. Rect covers the whole map; no-op when tint
 * resolves to transparent.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { mapsSignal, activeMapIdSignal, settingsSignal } from '../state/signals.js';
import { createEnvTintLayer } from '../map/layers/env-tint.js';

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
  return { zoom: 1, state: { map: null, settings: {} } };
}

describe('createEnvTintLayer', () => {
  let stage, dispose, layer;

  beforeEach(() => {
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
    settingsSignal.value = {};
    stage = makeStage();
    const api = createEnvTintLayer(stage, makeMr());
    layer = api.layer;
    dispose = api.dispose;
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
    settingsSignal.value = {};
  });

  // drag-perf cluster: env-tint now keeps a single pre-allocated Rect
  // and toggles visibility instead of destroyChildren-and-create per
  // sync. The Rect is always present in the layer; "off" means
  // `rect.visible() === false` rather than `find('Rect').length === 0`.
  const visibleRects = () => layer.find('Rect').filter((r) => r.visible());

  it('no map → layer has no visible Rect', () => {
    expect(visibleRects().length).toBe(0);
  });

  it('environment tint produces a single visible Rect covering the map', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40 }]]);
    activeMapIdSignal.value = 'm1';
    settingsSignal.value = { environment: { weather: 'snow' } };
    const rects = visibleRects();
    expect(rects.length).toBe(1);
    expect(rects[0].width()).toBe(160);
    expect(rects[0].height()).toBe(160);
  });

  it('transparent tint → no visible Rect', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40 }]]);
    activeMapIdSignal.value = 'm1';
    settingsSignal.value = { environment: { weather: 'clear', time_of_day: 'noon' } };
    expect(visibleRects().length).toBe(0);
  });

  it('per-map env_tint preset (e.g. "cave") produces a visible Rect', () => {
    mapsSignal.value = new Map([['m1', { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40, env_tint: 'cave' }]]);
    activeMapIdSignal.value = 'm1';
    expect(visibleRects().length).toBe(1);
  });

  it('map.env_tint takes precedence over settings.environment', () => {
    mapsSignal.value = new Map([
      ['m1', { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40, env_tint: 'daylight' }],
    ]);
    activeMapIdSignal.value = 'm1';
    settingsSignal.value = { environment: { weather: 'snow' } };
    // daylight resolves to transparent, so even though settings would tint, no Rect renders.
    expect(visibleRects().length).toBe(0);
  });

  it('switching active map switches tint when env_tint differs', () => {
    mapsSignal.value = new Map([
      ['m1', { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40, env_tint: 'daylight' }],
      ['m2', { id: 'm2', width_cells: 4, height_cells: 4, cell_px: 40, env_tint: 'dusk' }],
    ]);
    activeMapIdSignal.value = 'm1';
    expect(visibleRects().length).toBe(0);
    activeMapIdSignal.value = 'm2';
    expect(visibleRects().length).toBe(1);
  });
});
