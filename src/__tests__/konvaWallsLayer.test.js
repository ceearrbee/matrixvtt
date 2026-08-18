/**
 * Konva walls layer - phase 4 of the Konva migration.
 *
 * GM-only visual: one Konva.Line per wall segment, dashed for open
 * doors, solid for sight-blocking walls. Diffs against `wallsSignal`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { wallsSignal, activeMapIdSignal } from '../state/signals.js';
import { createWallsLayer } from '../map/layers/walls.js';

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

function makeMr(isGM = true, extraState = {}) {
  return {
    zoom: 1,
    activeTool: 'pointer',
    drawing: { isActive: false, start: null, current: null },
    state: { isGM: () => isGM, ...extraState },
  };
}

describe('createWallsLayer', () => {
  let stage;
  let dispose;
  let layer;
  let lines;

  beforeEach(() => {
    wallsSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ layer, lines, dispose } = createWallsLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    wallsSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders a Line for each wall (GM view)', () => {
    wallsSignal.value = new Map([
      ['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } }],
      ['w2', { id: 'w2', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 0, y: 100 } }],
    ]);
    expect(lines.size).toBe(2);
  });

  it('draws open doors dashed', () => {
    wallsSignal.value = new Map([
      ['door', { id: 'door', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, blocks_sight: false }],
    ]);
    const line = lines.get('door');
    const dash = line.dash();
    expect(Array.isArray(dash) && dash.length > 0).toBe(true);
  });

  it('non-GM sees no walls', () => {
    dispose();
    stage.destroy();
    stage = makeStage();
    ({ layer, lines, dispose } = createWallsLayer(stage, makeMr(false)));
    wallsSignal.value = new Map([
      ['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } }],
    ]);
    expect(lines.size).toBe(0);
  });

  it('renders an open portal with a dashed stroke', () => {
    wallsSignal.value = new Map([
      ['p', { id: 'p', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, is_portal: true, is_open: true, blocks_sight: false }],
    ]);
    const line = lines.get('p');
    expect(Array.isArray(line.dash()) && line.dash().length > 0).toBe(true);
  });

  it('renders a closed portal with a solid stroke and thicker line', () => {
    wallsSignal.value = new Map([
      ['p', { id: 'p', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, is_portal: true, is_open: false, blocks_sight: true }],
    ]);
    const line = lines.get('p');
    expect(line.dash()).toEqual([]);
    expect(line.strokeWidth()).toBeGreaterThan(2);
  });

  it('clicking a portal toggles is_open via state.updateWall (GM)', async () => {
    dispose();
    stage.destroy();
    stage = makeStage();
    const updates = [];
    const updateWall = (id, patch) => updates.push({ id, patch });
    ({ layer, lines, dispose } = createWallsLayer(stage, makeMr(true, { updateWall })));
    wallsSignal.value = new Map([
      ['p', { id: 'p', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, is_portal: true, is_open: false, blocks_sight: true, blocks_movement: true }],
    ]);
    const line = lines.get('p');
    line.fire('click', { type: 'click' });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('p');
    expect(updates[0].patch).toEqual({ is_open: true, blocks_sight: false, blocks_movement: false });
  });

  it('non-GM portals are not interactive', () => {
    dispose();
    stage.destroy();
    stage = makeStage();
    const updates = [];
    const updateWall = (id, patch) => updates.push({ id, patch });
    ({ layer, lines, dispose } = createWallsLayer(stage, makeMr(false, { updateWall })));
    wallsSignal.value = new Map([
      ['p', { id: 'p', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, is_portal: true, is_open: false }],
    ]);
    expect(lines.size).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('removes wall shapes when entries are deleted', () => {
    wallsSignal.value = new Map([
      ['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } }],
      ['w2', { id: 'w2', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 0, y: 10 } }],
    ]);
    expect(lines.size).toBe(2);
    wallsSignal.value = new Map([['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } }]]);
    expect(lines.size).toBe(1);
  });
});

describe('createWallsLayer - per-map scoping (Phase 1)', () => {
  let stage, dispose, lines;

  beforeEach(() => {
    wallsSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ lines, dispose } = createWallsLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    wallsSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('renders only walls whose map_id matches activeMapId', () => {
    wallsSignal.value = new Map([
      ['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 } }],
      ['w2', { id: 'w2', map_id: 'map-b', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 } }],
    ]);
    expect(lines.size).toBe(1);
    expect(lines.has('w1')).toBe(true);
  });

  it('hides previous-map walls after activeMapId changes', () => {
    wallsSignal.value = new Map([
      ['w1', { id: 'w1', map_id: 'map-a', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 } }],
    ]);
    expect(lines.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(lines.size).toBe(0);
  });
});
