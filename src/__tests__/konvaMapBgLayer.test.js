/**
 * Konva map-background layer - phase 7.
 *
 * Image-layer stack driven by state.map.layers[]; fallback solid
 * floor when no layers are present. One Konva.Image per visible
 * layer, with GM-only layers alpha-reduced to 0.2.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { mapsSignal, activeMapIdSignal } from '../state/signals.js';
import { createMapBgLayer } from '../map/layers/map-bg.js';

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

function makeMr(overrides = {}) {
  return {
    zoom: 1,
    _tokenImages: new Map(),
    _colors: { mapFloor: '#1a2035' },
    state: {
      isGM: () => true,
      map: null,
      widgetManager: { _client: { homeserver: 'https://hs.example' } },
      ...overrides.state,
    },
  };
}

describe('createMapBgLayer', () => {
  let stage;
  let dispose;
  let layer;
  let api;

  beforeEach(() => {
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
    stage = makeStage();
    const mr = makeMr();
    api = createMapBgLayer(stage, mr);
    layer = api.layer;
    dispose = api.dispose;
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    mapsSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders a fallback floor Rect when map has no layers', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40, layers: [],
    }]]);
    activeMapIdSignal.value = 'm1';
    const rects = layer.find('Rect');
    expect(rects.length).toBe(1);
    expect(rects[0].width()).toBe(160);
    expect(rects[0].height()).toBe(160);
  });

  it('renders one Konva.Image per visible layer', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40,
      layers: [
        { id: 'a', image_url: 'https://x/a.png', visible: true, opacity: 1 },
        { id: 'b', image_url: 'https://x/b.png', visible: true, opacity: 0.5 },
        { id: 'c', image_url: 'https://x/c.png', visible: false, opacity: 1 },
      ],
    }]]);
    activeMapIdSignal.value = 'm1';
    expect(layer.find('Image').length).toBe(2);
  });

  it('dispose stops further signal-driven updates', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40, layers: [],
    }]]);
    activeMapIdSignal.value = 'm1';
    dispose();
    activeMapIdSignal.value = null;
    expect(layer.find('Rect').length).toBe(1); // no further rebuild
  });
});
