/**
 * Token name labels must not wrap: they were wrapping
 * to a second line for any name longer than the label width (`radius * 4`).
 * Real-world repro: "Orc War Boss" rendered as "Orc War" / "Boss" stacked,
 * which collided visually with adjacent tokens' labels.
 *
 * Fix: drop the wrap-forcing width constraint and center the rendered
 * single-line text via offsetX. Adjacent tokens may still overlap
 * horizontally but each label stays one piece.
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
      measureText: () => ({ width: 60 }),
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

function findChild(group, name) {
  return group.findOne((n) => n.attrs?.name === name);
}

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
    },
  };
}

describe('token name label - no forced wrap', () => {
  let stage, dispose, groups;
  beforeEach(() => {
    tokensSignal.value = new Map();
    activeMapIdSignal.value = 'map-a';
    stage = makeStage();
    ({ dispose, groups } = createTokensLayer(stage, makeMr()));
  });
  afterEach(() => {
    dispose?.();
    stage.destroy();
    stage.container()?.remove();
    tokensSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('sets wrap=none on the name label so long names stay on one line', () => {
    tokensSignal.value = new Map([
      ['t-boss', { id: 't-boss', map_id: 'map-a', col: 2, row: 2, name: 'Orc War Boss' }],
    ]);
    const tokenGroup = groups.get('t-boss');
    expect(tokenGroup).toBeDefined();
    const nameNode = findChild(tokenGroup, 'name');
    // Konva.Text's default wrap is 'word'. Forcing 'none' guarantees long
    // names like "Orc War Boss" don't break into "Orc War" / "Boss" stacks
    // that collide with adjacent tokens' labels.
    expect(nameNode.wrap()).toBe('none');
  });
});
