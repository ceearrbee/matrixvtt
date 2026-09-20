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

function loadedImage() {
  const img = new EventTarget();
  img.complete = true;
  img.naturalWidth = 512;
  return img;
}

function pendingImage() {
  const img = new EventTarget();
  img.complete = false;
  img.naturalWidth = 0;
  return img;
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

  it('fills with a repeating tile pattern when the tile has decoded', () => {
    const mr = makeMr();
    mr._tokenImages.set('/backgrounds/tiles/stone-floor.webp', loadedImage());
    const api2 = createMapBgLayer(stage, mr);
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40,
      background: { kind: 'tile', tile: 'stone-floor', scale: 1 },
    }]]);
    activeMapIdSignal.value = 'm1';
    const rects = api2.layer.find('Rect');
    expect(rects.length).toBe(1);
    expect(rects[0].width()).toBe(160);
    expect(rects[0].fillPatternRepeat()).toBe('repeat');
    expect(rects[0].fillPatternImage()).toBeTruthy();
    expect(rects[0].fill()).toBeFalsy();
    api2.dispose();
  });

  // Konva caches the CanvasPattern on first draw, so a Rect built while
  // the tile was still decoding would stay blank forever. Paint the theme
  // floor until it lands, then rebuild.
  it('shows the theme floor until the tile decodes, then repaints with the pattern', () => {
    const mr = makeMr();
    const pending = pendingImage();
    mr._tokenImages.set('/backgrounds/tiles/stone-floor.webp', pending);
    const api2 = createMapBgLayer(stage, mr);
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40,
      background: { kind: 'tile', tile: 'stone-floor', scale: 1 },
    }]]);
    activeMapIdSignal.value = 'm1';

    expect(api2.layer.find('Rect')[0].fillPatternImage()).toBeFalsy();
    expect(api2.layer.find('Rect')[0].fill()).toBe('#1a2035');

    pending.complete = true;
    pending.naturalWidth = 512;
    pending.dispatchEvent(new Event('load'));

    expect(api2.layer.find('Rect')[0].fillPatternImage()).toBe(pending);
    api2.dispose();
  });

  it('keeps image layers above a tile fill', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40,
      background: { kind: 'tile', tile: 'stone-floor' },
      layers: [{ id: 'a', image_url: 'https://x/a.png', visible: true, opacity: 1 }],
    }]]);
    activeMapIdSignal.value = 'm1';
    expect(layer.find('Rect').length).toBe(1);
    expect(layer.find('Image').length).toBe(1);
    expect(layer.getChildren()[0].getClassName()).toBe('Rect');
  });

  // The signature cache short-circuits repaint during pan and drag. If the
  // background descriptor is not part of it, changing the tile does nothing.
  it('repaints when only the background descriptor changes', () => {
    const base = { id: 'm1', width_cells: 4, height_cells: 4, cell_px: 40 };
    mapsSignal.value = new Map([['m1', { ...base, background: { kind: 'tile', tile: 'stone-floor' } }]]);
    activeMapIdSignal.value = 'm1';
    const first = layer.getChildren()[0];
    mapsSignal.value = new Map([['m1', { ...base, background: { kind: 'tile', tile: 'cobble' } }]]);
    expect(layer.getChildren()[0]).not.toBe(first);
  });

  it('paints a generated background as a single canvas image', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 8, cell_px: 40,
      background: { kind: 'generated', generator: 'dungeon', seed: 'a7f3c2', style: 'lines' },
    }]]);
    activeMapIdSignal.value = 'm1';
    expect(layer.find('Image').length).toBe(1);
    expect(layer.find('Rect').length).toBe(0);
    const img = layer.find('Image')[0];
    expect(img.width()).toBe(400);
    expect(img.height()).toBe(320);
  });

  it('keeps image layers above a generated fill', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 8, cell_px: 40,
      background: { kind: 'generated', generator: 'dungeon', seed: 'a7f3c2', style: 'lines' },
      layers: [{ id: 'a', image_url: 'https://x/a.png', visible: true, opacity: 1 }],
    }]]);
    activeMapIdSignal.value = 'm1';
    expect(layer.find('Image').length).toBe(2);
    expect(layer.getChildren()[0].name()).toBe('generated-bg');
  });

  it('falls back to the theme floor when the descriptor names no real generator', () => {
    mapsSignal.value = new Map([['m1', {
      id: 'm1', width_cells: 10, height_cells: 8, cell_px: 40,
      background: { kind: 'generated', generator: 'hologram', seed: 'a7f3c2' },
    }]]);
    activeMapIdSignal.value = 'm1';
    const rects = layer.find('Rect');
    expect(rects.length).toBe(1);
    expect(rects[0].fill()).toBe('#1a2035');
  });

  it('repaints when only the seed changes', () => {
    const base = {
      id: 'm1', width_cells: 10, height_cells: 8, cell_px: 40,
    };
    mapsSignal.value = new Map([['m1', { ...base, background: { kind: 'generated', generator: 'dungeon', seed: 'aaa', style: 'lines' } }]]);
    activeMapIdSignal.value = 'm1';
    const first = layer.getChildren()[0];
    mapsSignal.value = new Map([['m1', { ...base, background: { kind: 'generated', generator: 'dungeon', seed: 'bbb', style: 'lines' } }]]);
    expect(layer.getChildren()[0]).not.toBe(first);
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
