/**
 * mapRendererSignalSubscription.test.js - renderer signal subscription lock-in.
 *
 * MapRenderer subscribes directly to the state signals
 * (tokens/fog/activeMap/etc.) via `effect()`. A change to any of those
 * signals must trigger render(). Runs against a real Konva Stage so
 * the entire layer-disposers + signal-effect plumbing is exercised.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { MapRenderer } from '../map-renderer.js';
import {
  tokensSignal, fogSignal, activeMapIdSignal, drawingsSignal, wallsSignal,
} from '../state/signals.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({
    canvas: null,
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
  el.getBoundingClientRect = () => ({ width: 800, height: 600, left: 0, top: 0 });
  document.body.appendChild(el);
  return el;
}

describe('MapRenderer subscribes to signals, not globalBus', () => {
  let mr;
  let renderSpy;
  const prior = [];

  beforeEach(() => {
    vi.useFakeTimers();
    while (prior.length) prior.pop().destroy();
    renderSpy = vi.spyOn(MapRenderer.prototype, 'render');
    renderSpy.mockClear();
    mr = new MapRenderer(makeCanvas(), { tokens: new Map(), isGM: () => false });
    prior.push(mr);
  });

  afterEach(() => {
    vi.useRealTimers();
    mr.destroy();
  });

  it('render fires when tokensSignal changes', async () => {
    const before = renderSpy.mock.calls.length;
    tokensSignal.value = new Map([['t1', { name: 'T' }]]);
    await vi.runAllTimersAsync();
    expect(renderSpy.mock.calls.length).toBeGreaterThan(before);
  });

  it('render fires when fogSignal changes', async () => {
    const before = renderSpy.mock.calls.length;
    fogSignal.value = { mode: 'revealed', revealed: [] };
    await vi.runAllTimersAsync();
    expect(renderSpy.mock.calls.length).toBeGreaterThan(before);
  });

  it('render fires when activeMapIdSignal changes', async () => {
    const before = renderSpy.mock.calls.length;
    activeMapIdSignal.value = 'map-new';
    await vi.runAllTimersAsync();
    expect(renderSpy.mock.calls.length).toBeGreaterThan(before);
  });

  it('destroy disposes the effect - further signal writes do not render', () => {
    mr.destroy();
    const before = renderSpy.mock.calls.length;
    drawingsSignal.value = [{ id: 'd1' }];
    wallsSignal.value = new Map([['w1', {}]]);
    expect(renderSpy.mock.calls.length).toBe(before);
  });
});
