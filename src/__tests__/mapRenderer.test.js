/**
 * MapRenderer unit tests
 *
 * Tests pure math helpers and state initialization.
 * Canvas rendering is not exercised - only logic that doesn't touch ctx.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MapRenderer } from '../map-renderer.js';
import { DEFAULTS, VTT_EVENTS } from '../utils/constants.js';
import { ZOOM_MIN, ZOOM_MAX } from '../map/input/pan-zoom.js';
import { getTokenRadius } from '../map/token-geometry.js';

// Konva needs a 2D context just to construct a Stage; stub happy-dom's.
// Restore in afterAll so later test files don't inherit the patched
// prototype (the leak adds suite-level teardown noise).
let _origGetContext = null;
beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({ canvas: null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
  }, {
    get(t, p) { return p in t ? t[p] : () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  _origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (k) {
    if (k === '2d') { const c = make2d(); c.canvas = this; return c; }
    return _origGetContext ? _origGetContext.call(this, k) : null;
  };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});
afterAll(() => {
  if (_origGetContext) {
    HTMLCanvasElement.prototype.getContext = _origGetContext;
    _origGetContext = null;
  }
});

// ─── Canvas + state mocks ─────────────────────────────────────────────────────

function makeCanvas() {
  const el = document.createElement('div');
  el.id = 'map-canvas';
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }
  );
  return { canvas: el };
}

function makeState() {
  return {
    map: null,
    tokens: new Map(),
    fog: { mode: 'hidden', revealed: [] },
    drawings: [],
    initiative: { active: false, order: [], current_index: 0, round: 0 },
    isGM: () => false,
    userId: '@test:server',
    subscribe: vi.fn(),
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRenderer() {
  const { canvas } = makeCanvas();
  const state = makeState();
  const renderer = new MapRenderer(canvas, state);
  return { renderer, state };
}

// ─── Constructor initialization ───────────────────────────────────────────────

describe('MapRenderer constructor', () => {
  it('initialises with correct defaults', () => {
    const { renderer } = makeRenderer();
    expect(renderer._touchDragPreview).toBeNull();
    expect(renderer.zoom).toBe(1);
    expect(renderer.panX).toBe(0);
    expect(renderer.panY).toBe(0);
  });
});

// ─── _getTokenRadius ──────────────────────────────────────────────────────────

describe('getTokenRadius', () => {
  it('returns base radius (cellSize * 0.375) for size 1', () => {
    expect(getTokenRadius({ size: 1 }, DEFAULTS.GRID_PX)).toBe(15);
  });

  it('returns base radius for token with no size property', () => {
    expect(getTokenRadius({}, DEFAULTS.GRID_PX)).toBe(15);
  });

  it('returns grid-aligned radius for size 2 (Large)', () => {
    expect(getTokenRadius({ size: 2 }, DEFAULTS.GRID_PX)).toBe(38);
  });

  it('returns grid-aligned radius for size 3 (Huge)', () => {
    expect(getTokenRadius({ size: 3 }, DEFAULTS.GRID_PX)).toBe(58);
  });

  it('scales with different cell sizes', () => {
    expect(getTokenRadius({ size: 1 }, 60)).toBe(22.5);
    expect(getTokenRadius({ size: 2 }, 60)).toBe(58);
    expect(getTokenRadius({ size: 3 }, 60)).toBe(88);
  });
});

// ─── Zoom bounds ──────────────────────────────────────────────────────────────

describe('MapRenderer zoom bounds', () => {
  let renderer;
  beforeEach(() => { ({ renderer } = makeRenderer()); });

  it('zoomIn increases zoom', () => {
    const before = renderer.zoom;
    renderer.zoomIn();
    expect(renderer.zoom).toBeGreaterThan(before);
  });

  it('zoomOut decreases zoom', () => {
    const before = renderer.zoom;
    renderer.zoomOut();
    expect(renderer.zoom).toBeLessThan(before);
  });

  it('zoomIn clamps at ZOOM_MAX (4.0)', () => {
    for (let i = 0; i < 100; i++) renderer.zoomIn();
    expect(renderer.zoom).toBe(ZOOM_MAX);
  });

  it('zoomOut clamps at ZOOM_MIN (0.25)', () => {
    for (let i = 0; i < 100; i++) renderer.zoomOut();
    expect(renderer.zoom).toBe(ZOOM_MIN);
  });
});

// `getCanvasCoords` + `getTokenAtPosition` moved off `MapRenderer` in
// phase 6; the underlying helpers are tested in hitTest.test.js. The
// renderer-level integration - that a stage click reaches the hit-test
// pipeline and selects the right token - is covered below.

describe('MapRenderer - pointer click selects tokens via setupTools', () => {
  it('clicking a token via the Konva stage sets selectedToken', () => {
    const { renderer, state } = makeRenderer();
    state.map = {
      image_url: null, width_cells: 10, height_cells: 10,
      cell_px: DEFAULTS.GRID_PX, offset_x: 0, offset_y: 0,
    };
    state.tokens.set('tok-1', { id: 'tok-1', col: 3, row: 2, name: 'Hero' });
    renderer.activeTool = 'pointer';
    // Cell (3, 2) centre at zoom=1, pan=0 = (140, 100).
    renderer.stage._fire('click', { evt: { clientX: 140, clientY: 100 } });
    expect(renderer.selectedToken).toBe('tok-1');
  });

  it('clicking empty space clears the selection', () => {
    const { renderer, state } = makeRenderer();
    state.map = {
      image_url: null, width_cells: 10, height_cells: 10,
      cell_px: DEFAULTS.GRID_PX, offset_x: 0, offset_y: 0,
    };
    state.tokens.set('tok-1', { id: 'tok-1', col: 3, row: 2 });
    renderer.activeTool = 'pointer';
    renderer.selectedToken = 'tok-1';
    renderer.stage._fire('click', { evt: { clientX: 5, clientY: 5 } });
    expect(renderer.selectedToken).toBeNull();
  });
});

// `getTokenInitials` was removed in phase 7 - the tokens layer
// computes initials inline from `token.name` and there were no
// external callers.

// Map-background rendering behaviour (fallback floor, image stack, GM-only
// layers) now lives on the Konva map-bg layer - see
// src/__tests__/konvaMapBgLayer.test.js.

// Token visibility behaviour (non-GM skips visible=false tokens) now lives on
// the Konva token layer - see src/__tests__/konvaTokenLayer.test.js. The
// legacy Canvas2D `_renderTokens` pass no longer exists.

// Fog-of-war rendering moved to the Konva fog layer; see konvaFogLayer.test.js.
// Grid rendering moved to the Konva grid layer; see konvaGridLayer.test.js.


// ─── toggleTokenVisibility / toggleTokenHPVisibility / _clearFacing error handling

describe('MapRenderer - token write error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, conditions: [], visible: true, show_hp: true, facing: null });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
  });

  it('toggleTokenVisibility dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.toggleTokenVisibility('tok-1');
    expect(errors).toHaveLength(1);
  });

  it('toggleTokenHPVisibility dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.toggleTokenHPVisibility('tok-1');
    expect(errors).toHaveLength(1);
  });

  it('_clearFacing dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer._clearFacing('tok-1');
    expect(errors).toHaveLength(1);
  });
});

// ─── fog update error handling ───────────────────────────────────────────────

describe('MapRenderer - fog error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.map = { image_url: null, width_cells: 10, height_cells: 10, cell_px: DEFAULTS.GRID_PX, offset_x: 0, offset_y: 0 };
    state.fog = { mode: 'hidden', revealed: [] };
    state.updateFog = vi.fn().mockRejectedValue(new Error('network fail'));
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
  });

  it('completeAreaSelection dispatches vtt:error when updateFog rejects', async () => {
    renderer.areaSelectionMode = 'reveal';
    renderer.areaSelectionStart = { x: 0, y: 0 };
    renderer.areaSelectionCurrent = { x: 40, y: 40 };
    await renderer.completeAreaSelection();
    expect(errors).toHaveLength(1);
  });

  it('_toggleSingleFogCell dispatches vtt:error when updateFog rejects', async () => {
    renderer.areaSelectionMode = 'reveal';
    await renderer._toggleSingleFogCell(20, 20);
    expect(errors).toHaveLength(1);
  });
});

// ─── showAddTokenDialog error handling ───────────────────────────────────────

describe('MapRenderer - showAddTokenDialog error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.map = { image_url: null, width_cells: 10, height_cells: 10, cell_px: DEFAULTS.GRID_PX, offset_x: 0, offset_y: 0 };
    state.characters = new Map();
    state.npcs = new Map();
    state.widgetManager = { userId: '@test:server' };
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('dispatches vtt:error when add token sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.showAddTokenDialog(2, 3);
    const form = document.querySelector('#add-token-form');
    form.querySelector('#token-name').value = 'Test';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(errors).toHaveLength(1);
  });
});

// ─── applyDamage / applyHealing error handling ───────────────────────────────

describe('MapRenderer - applyDamage / applyHealing error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, name: 'Hero', conditions: [], hp_current: 20, hp_max: 30 });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
  });

  it('applyDamage dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.applyDamage('tok-1', 5);
    expect(errors).toHaveLength(1);
  });

  it('applyHealing dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.applyHealing('tok-1', 5);
    expect(errors).toHaveLength(1);
  });
});

// ─── showConditionDialog apply handler error handling ─────────────────────────

describe('MapRenderer - showConditionDialog error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, name: 'Hero', conditions: [] });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('dispatches vtt:error when sendStateEvent rejects in apply handler', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    renderer.showConditionDialog('tok-1');
    const applyBtn = document.querySelector('#cond-apply-btn');
    applyBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(errors).toHaveLength(1);
  });
});

// ─── _startFacingMode click handler error handling ────────────────────────────

describe('MapRenderer - _startFacingMode error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.map = { image_url: null, width_cells: 10, height_cells: 10, cell_px: DEFAULTS.GRID_PX, offset_x: 0, offset_y: 0 };
    state.tokens.set('tok-1', { id: 'tok-1', col: 2, row: 2, conditions: [], facing: null });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    renderer._exitFacingMode();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('dispatches vtt:error when sendStateEvent rejects in facing click handler', async () => {
    state.updateToken = vi.fn().mockRejectedValue(new Error('network fail'));
    renderer._startFacingMode('tok-1');
    // Drive the click through the Konva stage where setupTools listens.
    renderer.stage._fire('click', { evt: { clientX: 200, clientY: 200 } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(errors).toHaveLength(1);
  });
});

// ─── removeToken confirm handler error handling ───────────────────────────────

describe('MapRenderer - removeToken error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, name: 'Hero', conditions: [] });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('dispatches vtt:error when sendStateEvent rejects in confirm handler', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    renderer.removeToken('tok-1');
    const confirmBtn = document.querySelector('#remove-confirm-btn');
    await confirmBtn.click();
    // allow microtasks to flush
    await Promise.resolve();
    expect(errors).toHaveLength(1);
  });
});

// ─── addCondition / removeCondition error handling ───────────────────────────

describe('MapRenderer - addCondition / removeCondition error handling', () => {
  let renderer, state, errors, onError;

  beforeEach(() => {
    errors = [];
    onError = (e) => errors.push(e.detail);
    window.addEventListener(VTT_EVENTS.ERROR, onError);
    ({ renderer, state } = makeRenderer());
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, conditions: [] });
  });

  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.ERROR, onError);
    vi.restoreAllMocks();
  });

  it('addCondition dispatches vtt:error when sendStateEvent rejects', async () => {
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.addCondition('tok-1', 'poisoned');
    expect(errors).toHaveLength(1);
  });

  it('removeCondition dispatches vtt:error when sendStateEvent rejects', async () => {
    state.tokens.set('tok-1', { id: 'tok-1', col: 0, row: 0, conditions: ['poisoned'] });
    state.sendStateEvent = vi.fn().mockRejectedValue(new Error('network fail'));
    await renderer.removeCondition('tok-1', 'poisoned');
    expect(errors).toHaveLength(1);
  });
});
