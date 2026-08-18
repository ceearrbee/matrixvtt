/**
 * Regression: the tokens layer's `keepId` filter must call
 * `state.isTokenVisibleToPlayer` as a method, not a detached function.
 * The StateManager method forwards to `reader.isTokenVisibleToPlayer(this, …)`,
 * and an unbound call ends up passing `undefined` as `sm`, crashing
 * inside `isGM` with "can't access property 'settings', sm is undefined".
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Konva from 'konva';
import { tokensSignal, activeMapIdSignal } from '../state/signals.js';
import { createTokensLayer } from '../map/layers/tokens.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({
    canvas: null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
  }, {
    get(t, p) { return p in t ? t[p] : () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (k) {
    if (k === '2d') { const c = make2d(); c.canvas = this; return c; }
    return orig ? orig.call(this, k) : null;
  };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});

function makeRig({ isGM = false } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });

  // A state-shaped object whose isTokenVisibleToPlayer reads `this.settings`,
  // mirroring the real StateManager's `reader.isGM(this)` chain.
  const state = {
    settings: { gm_user_ids: isGM ? ['@me:hs'] : [] },
    map: { cell_px: 40, width_cells: 10, height_cells: 10 },
    tokens: new Map([['t1', { id: 't1', map_id: 'map-a', col: 1, row: 1, size: 1, name: 'A' }]]),
    fog: { mode: 'hidden', revealed: [] },
    widgetManager: { userId: '@me:hs' },
    isGM() { return this.settings.gm_user_ids.includes(this.widgetManager.userId); },
    isTokenVisibleToPlayer(_token, _revealedSet) {
      // Real method touches this.settings; verify we received `this`.
      if (!this || !this.settings) {
        throw new TypeError("can't access property 'settings', sm is undefined");
      }
      return true;
    },
  };

  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    state,
    selectedToken: null,
    _colors: {},
  };
  return { stage, mr, container, state };
}

describe('tokens layer keepId calls isTokenVisibleToPlayer with proper this', () => {
  let rig;
  beforeEach(() => {
    activeMapIdSignal.value = 'map-a';
    rig = makeRig({ isGM: false });
  });
  afterEach(() => {
    rig.stage.destroy();
    rig.container.remove();
    tokensSignal.value = new Map();
    activeMapIdSignal.value = null;
  });

  it('does not throw when a token sync runs as a non-GM viewer', () => {
    const layer = createTokensLayer(rig.stage, rig.mr);
    expect(() => {
      tokensSignal.value = new Map([['t1', { id: 't1', map_id: 'map-a', col: 1, row: 1, size: 1, name: 'A' }]]);
    }).not.toThrow();
    layer.dispose();
  });

  it('actually invokes isTokenVisibleToPlayer (so the regression check is meaningful)', () => {
    const spy = vi.spyOn(rig.state, 'isTokenVisibleToPlayer');
    const layer = createTokensLayer(rig.stage, rig.mr);
    tokensSignal.value = new Map([['t1', { id: 't1', map_id: 'map-a', col: 1, row: 1, size: 1, name: 'A' }]]);
    expect(spy).toHaveBeenCalled();
    layer.dispose();
  });
});
