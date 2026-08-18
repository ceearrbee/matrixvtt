/**
 * MapRenderer.updateThemeColors() - HP palette bridge.
 *
 * The canvas renderer paints HP bars on a raw 2D context. Canvas fillStyle
 * cannot resolve CSS variable references like `var(--color-text-success)`, so
 * the renderer snapshots computed CSS values into `mr._colors` on init and
 * whenever the theme changes. The HP palette must be part of that snapshot so
 * tokens.js can look up hpGood/hpWarn/hpDanger without duplicating hex codes.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { MapRenderer } from '../map-renderer.js';

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

function makeCanvas() {
  const el = document.createElement('div');
  el.id = 'map-canvas';
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }
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

describe('MapRenderer.updateThemeColors - HP palette', () => {
  let originalGCS;

  beforeEach(() => {
    originalGCS = globalThis.getComputedStyle;
    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: (name) => {
        const values = {
          '--color-map-bg': '#000000',
          '--color-map-floor': '#111111',
          '--color-grid-line': 'rgba(255,255,255,0.1)',
          '--color-text-success': '#1D9E75',
          '--color-text-warning': '#EF9F27',
          '--color-text-danger': '#E24B4A',
        };
        return values[name] || '';
      },
    }));
  });

  afterEach(() => {
    globalThis.getComputedStyle = originalGCS;
    vi.restoreAllMocks();
  });

  it('snapshots HP palette into _colors on init', () => {
    const mr = new MapRenderer(makeCanvas(), makeState());
    expect(mr._colors.hpGood).toBe('#1D9E75');
    expect(mr._colors.hpWarn).toBe('#EF9F27');
    expect(mr._colors.hpDanger).toBe('#E24B4A');
    mr.destroy();
  });

  it('falls back to safe hex defaults when CSS vars are blank', () => {
    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: () => '',
    }));
    const mr = new MapRenderer(makeCanvas(), makeState());
    expect(mr._colors.hpGood).toMatch(/^#[0-9A-F]{6}$/i);
    expect(mr._colors.hpWarn).toMatch(/^#[0-9A-F]{6}$/i);
    expect(mr._colors.hpDanger).toMatch(/^#[0-9A-F]{6}$/i);
    mr.destroy();
  });
});
