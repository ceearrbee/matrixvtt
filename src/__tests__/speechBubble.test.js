/**
 * Speech-bubble layer + map-renderer wiring.
 *
 * Previously chat-send.js and lifecycle-init.js called
 * `ui.mapRenderer.showSpeechBubble(tokenId, body)`, but the method
 * was never defined - optional chaining short-circuited every call
 * and no bubble ever appeared on the map.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Konva from 'konva';
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

describe('speech-bubbles layer', () => {
  it('addBubble adds a Konva Label to the layer', () => {
    const stage = makeStage();
    const api = createSpeechBubblesLayer(stage, null);
    const before = api.layer.getChildren().length;
    api.addBubble(100, 100, 'hello');
    expect(api.layer.getChildren().length).toBe(before + 1);
  });

  it('addBubble is a no-op when body is blank', () => {
    const stage = makeStage();
    const api = createSpeechBubblesLayer(stage, null);
    const before = api.layer.getChildren().length;
    api.addBubble(100, 100, '   ');
    api.addBubble(100, 100, null);
    expect(api.layer.getChildren().length).toBe(before);
  });

  it('long bodies are truncated', () => {
    const stage = makeStage();
    const api = createSpeechBubblesLayer(stage, null);
    const body = 'a'.repeat(500);
    api.addBubble(50, 50, body);
    const label = api.layer.getChildren().at(-1);
    const text = label.find('Text')[0];
    const rendered = text?.text?.();
    expect(rendered.length).toBeLessThanOrEqual(80);
    expect(rendered.endsWith('…')).toBe(true);
  });
});

describe('MapRenderer.showSpeechBubble - wiring', () => {
  let mr;
  let addBubble;

  beforeEach(() => {
    addBubble = vi.fn();
    mr = {
      _speechBubblesApi: { addBubble },
      state: {
        tokens: new Map([
          ['t1', { id: 't1', col: 3, row: 4, size: 1 }],
          ['t2', { id: 't2', col: 1, row: 1, size: 2 }],
        ]),
        map: { cell_px: 40, grid_type: 'square', width_cells: 20, height_cells: 20 },
      },
    };
    // Import the prototype method dynamically - we don't want a full
    // MapRenderer instance (it needs a DOM container + signals); just
    // bind the function to our fake.
    return import('../map-renderer.js').then(({ MapRenderer }) => {
      mr.showSpeechBubble = MapRenderer.prototype.showSpeechBubble.bind(mr);
    });
  });

  it('forwards size=1 token coords (cell centre) to addBubble', () => {
    mr.showSpeechBubble('t1', 'hi');
    expect(addBubble).toHaveBeenCalledTimes(1);
    const [x, y, body] = addBubble.mock.calls[0];
    // square grid: cellToPixel returns ((col+0.5)*cellPx, (row+0.5)*cellPx).
    expect(x).toBe((3 + 0.5) * 40);
    expect(y).toBe((4 + 0.5) * 40);
    expect(body).toBe('hi');
  });

  it('handles size>1 tokens by centring on the bounding box', () => {
    mr.showSpeechBubble('t2', 'roar');
    const [x, y] = addBubble.mock.calls[0];
    expect(x).toBe((1 + 1) * 40); // (col + size/2) * cellPx
    expect(y).toBe((1 + 1) * 40);
  });

  it('no-ops when the token is missing from state.tokens', () => {
    mr.showSpeechBubble('does-not-exist', 'hi');
    expect(addBubble).not.toHaveBeenCalled();
  });

  it('no-ops when state.map is null', () => {
    mr.state.map = null;
    mr.showSpeechBubble('t1', 'hi');
    expect(addBubble).not.toHaveBeenCalled();
  });

  it('no-ops when _speechBubblesApi is unset', () => {
    mr._speechBubblesApi = null;
    expect(() => mr.showSpeechBubble('t1', 'hi')).not.toThrow();
  });
});
