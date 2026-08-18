/**
 * A token drag must not call MapRenderer.render(): that re-syncs all ten
 * layers per pointer event - walls re-walk their whole segment map, grid
 * / map-bg / drawings / templates / pins / env-tint all re-sync even
 * though a moving token can't change what they draw.
 *
 * renderDragFrame() syncs only the layers whose output depends on token
 * position (tokens, lights, overlays, fog-vision) and collapses multiple
 * pointer events in one frame into a single sync.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { MapRenderer } from '../map-renderer.js';

let _origGetContext = null;
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
  _origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (k) {
    if (k === '2d') { const c = make2d(); c.canvas = this; return c; }
    return _origGetContext ? _origGetContext.call(this, k) : null;
  };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});
afterAll(() => {
  if (_origGetContext) {
    HTMLCanvasElement.prototype.getContext = _origGetContext;
    _origGetContext = null;
  }
});

function makeRenderer() {
  const canvas = document.createElement('div');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    { width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 },
  );
  const state = {
    map: null,
    tokens: new Map(),
    fog: { mode: 'hidden', revealed: [] },
    drawings: [],
    initiative: { active: false, order: [], current_index: 0, round: 0 },
    isGM: () => false,
    userId: '@test:server',
    subscribe: vi.fn(),
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
  };
  return new MapRenderer(canvas, state);
}

describe('MapRenderer.renderDragFrame', () => {
  it('exposes a drag-layer subset smaller than the full syncer list', () => {
    const mr = makeRenderer();
    expect(Array.isArray(mr._dragLayerSyncers)).toBe(true);
    expect(mr._dragLayerSyncers.length).toBeGreaterThan(0);
    expect(mr._dragLayerSyncers.length).toBeLessThan(mr._layerSyncers.length);
    mr.destroy();
  });

  it('syncs tokens plus only the drag layers, never the full list', () => {
    const mr = makeRenderer();
    const tokens = vi.fn();
    const drag = [vi.fn(), vi.fn()];
    const others = [vi.fn(), vi.fn(), vi.fn()];
    mr._syncTokensLayer = tokens;
    mr._dragLayerSyncers = drag;
    mr._layerSyncers = [...drag, ...others];

    mr.renderDragFrame();

    expect(tokens).toHaveBeenCalledTimes(1);
    for (const d of drag) expect(d).toHaveBeenCalledTimes(1);
    for (const o of others) expect(o).not.toHaveBeenCalled();
    mr.destroy();
  });

  it('collapses several drag frames requested in one animation frame', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => 1);
    const mr = makeRenderer();
    const tokens = vi.fn();
    mr._syncTokensLayer = tokens;
    mr._dragLayerSyncers = [];

    mr.requestDragFrame();
    mr.requestDragFrame();
    mr.requestDragFrame();

    expect(raf).toHaveBeenCalledTimes(1);
    expect(tokens).not.toHaveBeenCalled();
    raf.mockRestore();
    mr.destroy();
  });

  it('runs the drag sync when the queued frame fires', () => {
    /** @type {Array<() => void>} */
    const queued = [];
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => { queued.push(cb); return queued.length; });
    const mr = makeRenderer();
    const tokens = vi.fn();
    mr._syncTokensLayer = tokens;
    mr._dragLayerSyncers = [];

    mr.requestDragFrame();
    for (const cb of queued) cb();

    expect(tokens).toHaveBeenCalledTimes(1);
    raf.mockRestore();
    mr.destroy();
  });
});
