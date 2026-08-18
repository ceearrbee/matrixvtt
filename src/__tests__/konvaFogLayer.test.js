/**
 * Konva fog layer - phase 5 of the Konva migration.
 *
 * Fog is a full-stage rect with holes cut out for revealed cells,
 * driven by `fogSignal`. `createFogLayer(stage, mr)` keeps the layer
 * in lockstep with fog mode + revealed cells. GM sees the fog at
 * reduced opacity; players see it opaque.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { fogSignal, activeMapIdSignal } from '../state/signals.js';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { UI_MODES } from '../utils/constants.js';
import { createFogLayer, paintFog } from '../map/layers/fog.js';

beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

const TEST_MAP_ID = 'map-test';

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

function makeMr(isGM = false) {
  return {
    zoom: 1,
    state: {
      isGM: () => isGM,
      map: { width_cells: 4, height_cells: 4, cell_px: 40 },
      tokens: new Map(),
      walls: new Map(),
      widgetManager: { userId: '@me:x' },
      settings: {},
      get fog() {
        const id = activeMapIdSignal.value;
        if (!id) return { mode: 'hidden', revealed: [] };
        return fogSignal.value.get(id) ?? { mode: 'hidden', revealed: [] };
      },
    },
  };
}

function setTestFog(fogObj) {
  fogSignal.value = new Map([[TEST_MAP_ID, fogObj]]);
  activeMapIdSignal.value = TEST_MAP_ID;
}

describe('createFogLayer', () => {
  let stage;
  let dispose;
  let layer;

  beforeEach(() => {
    setTestFog({ mode: 'hidden', revealed: [] });
    stage = makeStage();
    ({ layer, dispose } = createFogLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    fogSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('fog layer visible when mode is hidden, hidden when visible', () => {
    expect(layer.visible()).toBe(true);
    setTestFog({ mode: 'visible', revealed: [] });
    expect(layer.visible()).toBe(false);
    setTestFog({ mode: 'hidden', revealed: [] });
    expect(layer.visible()).toBe(true);
  });

  it('paintFog uses reduced-alpha fill for the GM, opaque for players', () => {
    const calls = [];
    const ctx = {
      beginPath: () => {}, rect: () => {}, fill: () => {},
      set fillStyle(v) { calls.push(v); },
    };
    setTestFog({ mode: 'hidden', revealed: [] });
    paintFog(ctx, makeMr(true));
    const gmFill = calls[calls.length - 1];
    calls.length = 0;
    paintFog(ctx, makeMr(false));
    const playerFill = calls[calls.length - 1];
    expect(gmFill).toContain('0.45');
    expect(playerFill).toBe('rgba(0, 0, 0, 1)');
  });

  it('paintFog no-ops when fog mode is not "hidden"', () => {
    const calls = [];
    const ctx = {
      beginPath: () => calls.push('beginPath'),
      rect: () => calls.push('rect'), fill: () => calls.push('fill'),
      set fillStyle(v) { calls.push(['fillStyle=', v]); },
    };
    setTestFog({ mode: 'visible', revealed: [] });
    paintFog(ctx, makeMr(true));
    expect(calls.length).toBe(0);
  });

  it('paintFog draws one rect for the map plus one per revealed cell', () => {
    let rectCount = 0;
    const ctx = {
      beginPath: () => {}, rect: () => { rectCount++; }, fill: () => {},
      set fillStyle(_) {},
    };
    setTestFog({ mode: 'hidden', revealed: ['0,0', '1,1', '2,2'] });
    paintFog(ctx, makeMr(false));
    expect(rectCount).toBe(1 + 3);
  });

  it('dispose stops further signal-driven updates', () => {
    expect(layer.visible()).toBe(true);
    dispose();
    setTestFog({ mode: 'visible', revealed: [] });
    expect(layer.visible()).toBe(true);
  });
});
