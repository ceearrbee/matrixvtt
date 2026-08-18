/**
 * Konva token layer - phase 3 of the Konva migration.
 *
 * `createTokensLayer(stage, mr)` attaches a Konva.Layer to `stage` and
 * keeps `Map<tokenId, Konva.Group>` in lockstep with `tokensSignal`.
 * Feature-parity rules:
 *
 *   - Adds a Group when a token appears, removes it when the token is
 *     deleted, and mutates the Group in place on updates.
 *   - Non-GMs skip tokens marked visible=false, exactly like the
 *     legacy renderer did.
 *   - dispose() stops further reactions.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { tokensSignal, activeMapIdSignal } from '../state/signals.js';
import { createTokensLayer } from '../map/layers/tokens.js';

// happy-dom does not implement the Canvas 2D context; Konva's SceneCanvas
// calls `ctx.scale(...)` on construction. Patch in a permissive stub just
// for these tests so a real Konva Stage can mount.
beforeAll(() => {
  const make2dCtx = () => {
    const base = {
      canvas: null, fillStyle: '', strokeStyle: '', font: '',
      globalAlpha: 1, lineWidth: 1, textAlign: '', textBaseline: '',
      shadowColor: '', shadowBlur: 0, lineCap: '', lineJoin: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      measureText: () => ({ width: 0 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => ({}),
    };
    return new Proxy(base, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => undefined;
      },
      set(target, prop, value) { target[prop] = value; return true; },
    });
  };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') {
      const ctx = make2dCtx();
      ctx.canvas = this;
      return ctx;
    }
    return orig ? orig.call(this, kind) : null;
  };
});

function makeStage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new Konva.Stage({ container, width: 400, height: 300 });
}

function makeMr(overrides = {}) {
  return {
    zoom: 1,
    selectedToken: null,
    _tokenImages: new Map(),
    _colors: {},
    state: {
      isGM: () => true,
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      fog: { revealed: [] },
      tokens: new Map(),
      settings: {},
      initiative: { active: false, order: [], current_index: 0 },
      widgetManager: { userId: '@me:x' },
    },
    ...overrides,
  };
}

describe('createTokensLayer', () => {
  let stage;
  let layer;
  let groups;
  let dispose;

  beforeEach(() => {
    tokensSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    const mr = makeMr();
    ({ layer, groups, dispose } = createTokensLayer(stage, mr));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    tokensSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('adds a Konva.Group when a new token appears in the signal', () => {
    expect(groups.size).toBe(0);
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'Aria', color: '#4a9' }],
    ]);
    expect(groups.size).toBe(1);
    const g = groups.get('t1');
    expect(g).toBeInstanceOf(Konva.Group);
    expect(layer.children.includes(g)).toBe(true);
  });

  it('mutates the existing Group in place on token update (no destroy/recreate)', () => {
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'Aria', color: '#4a9' }],
    ]);
    const originalGroup = groups.get('t1');
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 5, row: 5, name: 'Aria', color: '#4a9' }],
    ]);
    expect(groups.get('t1')).toBe(originalGroup);
  });

  it('destroys the Group when a token is removed from the signal', () => {
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
      ['t2', { id: 't2', map_id: 'map-a', col: 1, row: 1, name: 'B' }],
    ]);
    expect(groups.size).toBe(2);
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
    ]);
    expect(groups.size).toBe(1);
    expect(groups.has('t2')).toBe(false);
  });

  it('non-GM viewer skips tokens with visible=false', () => {
    dispose();
    stage.destroy();
    stage = makeStage();
    const mr = makeMr({ state: { ...makeMr().state, isGM: () => false } });
    ({ layer, groups, dispose } = createTokensLayer(stage, mr));

    tokensSignal.value = new Map([
      ['hidden', { id: 'hidden', map_id: 'map-a', col: 1, row: 1, visible: false, name: 'Ghost' }],
      ['shown', { id: 'shown', map_id: 'map-a', col: 2, row: 2, name: 'Hero' }],
    ]);
    expect(groups.has('hidden')).toBe(false);
    expect(groups.has('shown')).toBe(true);
  });

  it('dispose stops further signal-driven updates', () => {
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
    ]);
    expect(groups.size).toBe(1);
    dispose();
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
      ['t2', { id: 't2', map_id: 'map-a', col: 0, row: 0, name: 'B' }],
    ]);
    expect(groups.has('t2')).toBe(false);
  });

  it('renders only tokens whose map_id matches activeMapId', () => {
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
      ['t2', { id: 't2', map_id: 'map-b', col: 1, row: 1, name: 'B' }],
    ]);
    expect(groups.size).toBe(1);
    expect(groups.has('t1')).toBe(true);
  });

  it('hides previous-map tokens after activeMapId changes', () => {
    tokensSignal.value = new Map([
      ['t1', { id: 't1', map_id: 'map-a', col: 0, row: 0, name: 'A' }],
    ]);
    expect(groups.size).toBe(1);
    activeMapIdSignal.value = 'map-b';
    expect(groups.size).toBe(0);
  });
});
