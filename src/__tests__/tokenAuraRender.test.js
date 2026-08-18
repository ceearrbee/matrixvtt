/**
 * Token auras: data already lived on tokens (aura_radius, aura_color
 * - set by TokenFormModal) but was never drawn. This locks in the
 * rendering plus the new generic `auras: [{radius, color, opacity?}]`
 * shape that lets a single token broadcast multiple radii (spell
 * range, sphere of influence, paladin aura, …).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { tokensSignal, activeMapIdSignal } from '../state/signals.js';
import { createTokensLayer } from '../map/layers/tokens.js';

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
      get(t, p) { return p in t ? t[p] : () => undefined; },
      set(t, p, v) { t[p] = v; return true; },
    });
  };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') { const c = make2dCtx(); c.canvas = this; return c; }
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
    zoom: 1, selectedToken: null, _tokenImages: new Map(), _colors: {},
    state: {
      isGM: () => true,
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      fog: { revealed: [] },
      tokens: new Map(),
      settings: {},
      initiative: { active: false, order: [], current_index: 0 },
      widgetManager: { userId: '@me:x' },
    },
  };
}

function visibleAuras(group) {
  // Return all aura circles that are currently visible
  const auras = group.findOne('.auras');
  if (!auras) return [];
  return auras.getChildren().filter((c) => c.visible());
}

let stage; let layer; let groups; let dispose;

beforeEach(() => {
  tokensSignal.value = new Map();
  activeMapIdSignal.value = 'map-a';
  stage = makeStage();
  ({ layer, groups, dispose } = createTokensLayer(stage, makeMr()));
});

afterEach(() => {
  dispose?.();
  stage.destroy();
  stage.container()?.remove();
  tokensSignal.value = new Map();
  activeMapIdSignal.value = null;
});

describe('token auras - rendering', () => {
  it('a token with no aura data renders zero aura circles', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T', color: '#abc',
    }]]);
    const g = groups.get('t1');
    expect(visibleAuras(g)).toHaveLength(0);
  });

  it('a token with legacy aura_radius > 0 renders one aura circle of that radius (in pixels)', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T',
      aura_radius: 3, aura_color: '#ff8800',
    }]]);
    const g = groups.get('t1');
    const auras = visibleAuras(g);
    expect(auras).toHaveLength(1);
    // 3 cells * 40 px/cell = 120 px radius
    expect(auras[0].radius()).toBe(120);
    expect(auras[0].fill()).toBe('#ff8800');
  });

  it('aura_radius === 0 renders no aura (the field already supported "0 = none")', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T', aura_radius: 0,
    }]]);
    expect(visibleAuras(groups.get('t1'))).toHaveLength(0);
  });

  it('a token with auras: [{radius, color}] renders one circle per entry', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T',
      auras: [
        { radius: 1, color: '#5BB8E8' },
        { radius: 3, color: '#1D9E75' },
      ],
    }]]);
    const auras = visibleAuras(groups.get('t1'));
    expect(auras).toHaveLength(2);
    const radii = auras.map((c) => c.radius()).sort((a, b) => a - b);
    expect(radii).toEqual([40, 120]); // 1*40, 3*40
  });

  it('auras[] takes precedence over legacy aura_radius when both are present', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T',
      aura_radius: 5, aura_color: '#ff0000',
      auras: [{ radius: 2, color: '#00ff00' }],
    }]]);
    const auras = visibleAuras(groups.get('t1'));
    expect(auras).toHaveLength(1);
    expect(auras[0].radius()).toBe(80);
    expect(auras[0].fill()).toBe('#00ff00');
  });

  it('removing aura data from a token clears the rendered circles', () => {
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T',
      aura_radius: 2, aura_color: '#abc',
    }]]);
    expect(visibleAuras(groups.get('t1'))).toHaveLength(1);
    // Re-render with no aura data
    tokensSignal.value = new Map([['t1', {
      id: 't1', map_id: 'map-a', col: 2, row: 3, name: 'T',
    }]]);
    expect(visibleAuras(groups.get('t1'))).toHaveLength(0);
  });
});
