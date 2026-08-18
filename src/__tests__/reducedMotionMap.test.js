/**
 * CSS cannot reach Konva: the map ping and speech-bubble animations
 * must consult the shared reduced-motion preference themselves. With
 * it set, the shapes still appear and still clean themselves up, just
 * without a tween.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { createPingsLayer } from '../map/layers/pings.js';
import { createSpeechBubblesLayer } from '../map/layers/speech-bubbles.js';

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

let stage;
let tweenSpy;

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.classList.add('reduced-motion');
  stage = makeStage();
  tweenSpy = vi.spyOn(Konva, 'Tween');
});

afterEach(() => {
  document.documentElement.classList.remove('reduced-motion');
  stage.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('pings under reduced motion', () => {
  it('shows a static ping without a tween and still removes it', () => {
    const api = createPingsLayer(stage, { zoom: 1 });
    api.addPing(50, 50, '#fff');

    expect(tweenSpy).not.toHaveBeenCalled();
    expect(api.layer.getChildren().length).toBe(1);

    vi.advanceTimersByTime(2500);
    expect(api.layer.getChildren().length).toBe(0);
  });
});

describe('speech bubbles under reduced motion', () => {
  it('shows the bubble without a fade tween and still removes it', () => {
    const api = createSpeechBubblesLayer(stage, { zoom: 1 });
    api.addBubble(50, 50, 'hello there');

    expect(api.layer.getChildren().length).toBeGreaterThan(0);
    vi.advanceTimersByTime(20000);
    expect(tweenSpy).not.toHaveBeenCalled();
    expect(api.layer.getChildren().length).toBe(0);
  });
});
