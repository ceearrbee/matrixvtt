/**
 * The tokens layer re-runs updateGroup for every visible token on every
 * sync, and sync runs once per frame while a token is dragged or the
 * turn ring pulses. updateGroup used to reach for each of its ~24 named
 * children with `group.findOne('.name')`, and Konva resolves a name
 * selector by walking the whole subtree, re-parsing the selector string
 * at every node it visits and splitting each node's name on whitespace.
 * That is thousands of throwaway arrays per frame on a busy map, for
 * children the layer built itself and has never moved.
 *
 * These tests lock in that the per-frame path reads cached references
 * instead of searching.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Konva from 'konva';
import { tokensSignal, activeMapIdSignal } from '../state/signals.js';
import { createTokensLayer } from '../map/layers/tokens.js';

// happy-dom has no Canvas 2D context; Konva's SceneCanvas calls
// ctx.scale(...) on construction. Same permissive stub the other
// Konva layer suites install.
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

function makeMr() {
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
      canMoveToken: () => true,
    },
  };
}

function token(extra = {}) {
  return {
    id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'Aria', color: '#4a9',
    hp_current: 10, hp_max: 10, conditions: ['prone', 'blinded'],
    auras: [{ radius: 2 }], facing: 0, ...extra,
  };
}

describe('tokens layer child lookup', () => {
  let stage;
  let groups;
  let dispose;

  beforeEach(() => {
    tokensSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ groups, dispose } = createTokensLayer(stage, makeMr()));
  });

  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    tokensSignal.value = new Map();
    activeMapIdSignal.value = null;
    vi.restoreAllMocks();
  });

  it('searches the group for its children no more than once per token', () => {
    tokensSignal.value = new Map([['t1', token()]]);
    const spy = vi.spyOn(Konva.Container.prototype, 'findOne');

    // An HP nudge: updateGroup re-runs for the token, the label
    // signature is unchanged so the placement pass stays skipped.
    // This is the shape of every frame of a pulse or a drag.
    tokensSignal.value = new Map([['t1', token({ hp_current: 7 })]]);

    expect(spy).not.toHaveBeenCalled();
  });

  it('still updates every child it no longer searches for', () => {
    tokensSignal.value = new Map([['t1', token()]]);
    const group = groups.get('t1');
    tokensSignal.value = new Map([['t1', token({ hp_current: 5, name: 'Bex', color: '#123456' })]]);

    expect(group.findOne('.body').fill()).toBe('#123456');
    expect(group.findOne('.name').text()).toBe('Bex');
    expect(group.findOne('.hpFg').visible()).toBe(true);
    expect(group.findOne('.condDot-0').visible()).toBe(true);
    expect(group.findOne('.condDot-2').visible()).toBe(false);
    expect(group.findOne('.aura-0').visible()).toBe(true);
    expect(group.findOne('.aura-1').visible()).toBe(false);
  });

  it('gives a recycled-free group its own reference set', () => {
    tokensSignal.value = new Map([
      ['t1', token()],
      ['t2', token({ id: 't2', col: 5, name: 'Bex' })],
    ]);
    const g1 = groups.get('t1');
    const g2 = groups.get('t2');
    expect(g1.findOne('.body')).not.toBe(g2.findOne('.body'));
    expect(g1.findOne('.name').text()).toBe('Aria');
    expect(g2.findOne('.name').text()).toBe('Bex');
  });
});
