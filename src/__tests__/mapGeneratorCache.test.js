/**
 * Memoised generated-background canvases.
 *
 * Regenerating and repainting a 2000px canvas on every pan frame is
 * exactly the allocation hot path the map-bg signature cache exists to
 * prevent, so this has to hand back the identical canvas until
 * something that actually changes the picture changes.
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  generatedSignature,
  getGeneratedCanvas,
  _resetGeneratedCache,
  GENERATED_CACHE_MAX,
} from '../map/generators/cache.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({
    canvas: null,
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }, {
    get(t, p) { return p in t ? t[p] : () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  HTMLCanvasElement.prototype.getContext = function () { const c = make2d(); c.canvas = this; return c; };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});

const COLORS = { mapFloor: '#1a2035', gridLine: 'rgba(255,255,255,0.08)' };

function makeMr() {
  return { _tokenImages: new Map(), _colors: COLORS, state: { widgetManager: {} }, render() {} };
}

const mapWith = (over = {}) => ({
  width_cells: 20, height_cells: 15, cell_px: 40,
  background: { kind: 'generated', generator: 'dungeon', seed: 'a7f3c2', palette: 'dungeon', style: 'textured', ...over },
});

describe('generatedSignature', () => {
  it('is empty for a map with no generated background', () => {
    expect(generatedSignature({ width_cells: 5, height_cells: 5, cell_px: 40 })).toBe('');
    expect(generatedSignature({ background: { kind: 'tile', tile: 'cobble' } })).toBe('');
  });

  it('changes with the seed, the palette, the style and the size', () => {
    const base = generatedSignature(mapWith());
    expect(generatedSignature(mapWith({ seed: 'other' }))).not.toBe(base);
    expect(generatedSignature(mapWith({ palette: 'crypt' }))).not.toBe(base);
    expect(generatedSignature(mapWith({ style: 'lines' }))).not.toBe(base);
    expect(generatedSignature({ ...mapWith(), cell_px: 50 })).not.toBe(base);
    expect(generatedSignature({ ...mapWith(), width_cells: 30 })).not.toBe(base);
  });

  it('is stable for the same inputs regardless of param key order', () => {
    const a = generatedSignature(mapWith({ params: { roomMin: 3, roomMax: 8 } }));
    const b = generatedSignature(mapWith({ params: { roomMax: 8, roomMin: 3 } }));
    expect(a).toBe(b);
  });
});

describe('getGeneratedCanvas', () => {
  beforeEach(() => { _resetGeneratedCache(); });

  it('returns null for a map with no generated background', () => {
    expect(getGeneratedCanvas(makeMr(), { width_cells: 5, height_cells: 5, cell_px: 40 })).toBeNull();
  });

  it('returns null for a generator or seed it cannot use', () => {
    const mr = makeMr();
    expect(getGeneratedCanvas(mr, mapWith({ generator: 'hologram' }))).toBeNull();
    expect(getGeneratedCanvas(mr, mapWith({ seed: 'not a seed!' }))).toBeNull();
  });

  it('paints a canvas at the map size', () => {
    const canvas = getGeneratedCanvas(makeMr(), mapWith());
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('hands back the identical canvas for an unchanged map', () => {
    const mr = makeMr();
    const first = getGeneratedCanvas(mr, mapWith());
    expect(getGeneratedCanvas(mr, mapWith())).toBe(first);
  });

  it('repaints when the seed changes', () => {
    const mr = makeMr();
    const first = getGeneratedCanvas(mr, mapWith());
    expect(getGeneratedCanvas(mr, mapWith({ seed: 'zzzz' }))).not.toBe(first);
  });

  it('evicts the oldest entry past the cache bound', () => {
    const mr = makeMr();
    const first = getGeneratedCanvas(mr, mapWith({ seed: 'aaaaa' }));
    for (let i = 0; i < GENERATED_CACHE_MAX; i += 1) {
      getGeneratedCanvas(mr, mapWith({ seed: `seed${i}` }));
    }
    expect(getGeneratedCanvas(mr, mapWith({ seed: 'aaaaa' }))).not.toBe(first);
  });

  it('asks for the palette tiles so a textured map can use them', () => {
    const mr = makeMr();
    getGeneratedCanvas(mr, mapWith());
    const requested = [...mr._tokenImages.keys()];
    expect(requested.some((u) => u.includes('stone-floor'))).toBe(true);
  });

  it('asks for no tiles at all in the plain line style', () => {
    const mr = makeMr();
    getGeneratedCanvas(mr, mapWith({ style: 'lines' }));
    expect([...mr._tokenImages.keys()]).toEqual([]);
  });
});
