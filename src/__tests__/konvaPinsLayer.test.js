/**
 * Konva pins layer - per-map scoping.
 *
 * `createPinsLayer(stage, mr)` renders one Group per pin from
 * `pinsSignal`, filtered to the active map.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { pinsSignal, activeMapIdSignal } from '../state/signals.js';
import { createPinsLayer } from '../map/layers/pins.js';

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

function makeMr(isGM = true) {
  return {
    zoom: 1,
    state: {
      isGM: () => isGM,
      map: { cell_px: 40 },
    },
  };
}

describe('createPinsLayer - per-map scoping (Phase 1)', () => {
  let stage, dispose, groups;

  beforeEach(() => {
    pinsSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ groups, dispose } = createPinsLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    pinsSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders only pins whose map_id matches activeMapId', () => {
    pinsSignal.value = new Map([
      ['p1', { id: 'p1', map_id: 'map-a', col: 1, row: 1, label: 'Inn' }],
      ['p2', { id: 'p2', map_id: 'map-b', col: 2, row: 2, label: 'Cave' }],
    ]);
    expect(groups.size).toBe(1);
    expect(groups.has('p1')).toBe(true);
  });

  it('hides previous-map pins after activeMapId changes', () => {
    pinsSignal.value = new Map([
      ['p1', { id: 'p1', map_id: 'map-a', col: 1, row: 1, label: 'Inn' }],
    ]);
    expect(groups.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(groups.size).toBe(0);
  });

  it('renders all active-map pins for GM', () => {
    pinsSignal.value = new Map([
      ['p1', { id: 'p1', map_id: 'map-a', col: 0, row: 0, label: 'A' }],
      ['p2', { id: 'p2', map_id: 'map-a', col: 1, row: 1, label: 'B', gm_only: true }],
    ]);
    expect(groups.size).toBe(2);
  });

  it('non-GM skips gm_only pins', () => {
    dispose();
    stage.destroy();
    stage = makeStage();
    ({ groups, dispose } = createPinsLayer(stage, makeMr(false)));
    pinsSignal.value = new Map([
      ['p1', { id: 'p1', map_id: 'map-a', col: 0, row: 0, label: 'Public' }],
      ['p2', { id: 'p2', map_id: 'map-a', col: 1, row: 1, label: 'Secret', gm_only: true }],
    ]);
    expect(groups.size).toBe(1);
    expect(groups.has('p1')).toBe(true);
  });
});
