/**
 * Konva pings layer - phase 5 of the Konva migration.
 *
 * `createPingsLayer(stage, mr)` exposes `addPing(x, y, color)`. Each
 * ping is a Konva.Circle animated by Konva.Tween (radius grows,
 * opacity fades). After the tween completes the node auto-destroys.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { createPingsLayer } from '../map/layers/pings.js';

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

describe('createPingsLayer', () => {
  let stage;
  let api;

  beforeEach(() => {
    stage = makeStage();
    api = createPingsLayer(stage, { zoom: 1 });
  });

  afterEach(() => {
    api.destroy?.();
    stage.destroy();
    stage.container()?.remove();
  });

  it('addPing adds a Circle to the layer', () => {
    api.addPing(50, 50, '#ff0000');
    expect(api.layer.find('Circle').length).toBe(1);
  });

  it('multiple pings coexist', () => {
    api.addPing(10, 10, '#f00');
    api.addPing(20, 20, '#0f0');
    api.addPing(30, 30, '#00f');
    expect(api.layer.find('Circle').length).toBe(3);
  });

  it('ping uses the supplied colour for stroke', () => {
    api.addPing(10, 10, '#abcdef');
    const circle = api.layer.find('Circle')[0];
    expect(circle.stroke().toLowerCase()).toBe('#abcdef');
  });
});
