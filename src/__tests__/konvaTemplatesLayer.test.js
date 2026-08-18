/**
 * Konva templates layer - phase 4 of the Konva migration.
 *
 * Persistent AoE templates placed by the GM. Circle, square, cone, and
 * line shapes. Diffs against `templatesSignal`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { templatesSignal, activeMapIdSignal } from '../state/signals.js';
import { createTemplatesLayer } from '../map/layers/templates.js';

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

function makeMr() {
  return {
    zoom: 1,
    state: { map: { cell_px: 40 } },
  };
}

describe('createTemplatesLayer', () => {
  let stage;
  let dispose;
  let layer;
  let groups;

  beforeEach(() => {
    templatesSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ layer, groups, dispose } = createTemplatesLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    templatesSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders a Circle for a circle template', () => {
    templatesSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', shape: 'circle', origin: { col: 1, row: 1 }, radius: 2, color: '#ff0000' }],
    ]);
    expect(layer.find('Circle').length).toBe(1);
  });

  it('renders a Rect for a square template', () => {
    templatesSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', shape: 'square', origin: { col: 2, row: 2 }, radius: 2, color: '#00ff00' }],
    ]);
    expect(layer.find('Rect').length).toBeGreaterThanOrEqual(1);
  });

  it('removes templates when entries are deleted', () => {
    templatesSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', shape: 'circle', origin: { col: 0, row: 0 }, radius: 1 }],
      ['t2', { id: 't2', map_id: 'map-a', shape: 'circle', origin: { col: 3, row: 3 }, radius: 1 }],
    ]);
    expect(groups.size).toBe(2);
    templatesSignal.value = new Map([['t1', { id: 't1', map_id: 'map-a', shape: 'circle', origin: { col: 0, row: 0 }, radius: 1 }]]);
    expect(groups.size).toBe(1);
    expect(groups.has('t2')).toBe(false);
  });

  it('renders only templates whose map_id matches activeMapId', () => {
    templatesSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', shape: 'circle', origin: { col: 0, row: 0 }, radius: 1 }],
      ['t2', { id: 't2', map_id: 'map-b', shape: 'circle', origin: { col: 1, row: 1 }, radius: 1 }],
    ]);
    expect(groups.size).toBe(1);
    expect(groups.has('t1')).toBe(true);
  });

  it('hides previous-map templates after activeMapId changes', () => {
    templatesSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', shape: 'circle', origin: { col: 0, row: 0 }, radius: 1 }],
    ]);
    expect(groups.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(groups.size).toBe(0);
  });
});
