/**
 * mapTools - dispatch coverage for the stage event handlers registered
 * by `setupTools`. The pure helpers (`buildStroke`, `buildWall`,
 * `buildTemplate`) are already pinned by `konvaToolInput.test.js`; the
 * finalize / erase / door-toggle paths by `wallTool`, `wallErase`,
 * `templateTool`, `wallDoorToggle`. This file covers what's left:
 * mousedown short-circuits, mousemove area-select, mouseup gating,
 * click priority order (pending-placement > facing > ping > pointer),
 * contextmenu token/pin/map dispatch, and the touch long-press timer.
 *
 * Handlers stay module-private - tests fire stage events through
 * `stage._fire`, the same rig pattern `wallTool.test.js` uses.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Konva from 'konva';
import { setupTools, strokeIsActive, strokeCancel } from '../map/input/tools.js';
import { pendingPlacementSignal } from '../state/signals.js';

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

function makeRig({ isGM = true, activeTool = 'pointer' } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const tokens = new Map();
  const walls = new Map();
  const pins = new Map();
  const templates = new Map();
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool,
    drawColor: '#fff', drawWidth: 2,
    _spaceDown: false,
    isDragging: false,
    areaSelectionMode: false,
    areaSelectionStart: null,
    areaSelectionCurrent: null,
    _pingMode: false,
    _facingModeTokenId: null,
    _measureStart: null,
    _measureEnd: null,
    state: {
      tokens, walls, pins, templates, drawings: [],
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      settings: { grid_type: 'square' },
      isGM: () => isGM,
      addDrawing: vi.fn().mockResolvedValue(),
      addWall: vi.fn().mockResolvedValue(),
      addTemplate: vi.fn().mockResolvedValue(),
      updateWall: vi.fn().mockResolvedValue(),
      updateToken: vi.fn().mockResolvedValue(),
      removeDrawing: vi.fn().mockResolvedValue(),
      removeWall: vi.fn().mockResolvedValue(),
      removeTemplate: vi.fn().mockResolvedValue(),
    },
    render: vi.fn(),
    setSelectedToken: vi.fn(),
    completeAreaSelection: vi.fn().mockResolvedValue(),
    showTokenContextMenu: vi.fn(),
    showPinContextMenu: vi.fn(),
    showMapContextMenu: vi.fn(),
    broadcastPing: vi.fn(),
    _exitFacingMode: vi.fn(),
    _ui: {},
  };
  // worldCoords uses container.getBoundingClientRect; jsdom returns
  // zeros, which is fine - clientX/clientY map directly to world.
  return { stage, mr, container, tokens, walls, pins };
}

function fireMouseDown(stage, { x = 0, y = 0, button = 0 } = {}) {
  stage._fire('mousedown', { evt: { button, clientX: x, clientY: y }, target: stage });
}
function fireMouseMove(stage, { x = 0, y = 0 } = {}) {
  stage._fire('mousemove', { evt: { clientX: x, clientY: y }, target: stage });
}
function fireMouseUp(stage, { x = 0, y = 0, button = 0 } = {}) {
  stage._fire('mouseup', { evt: { button, clientX: x, clientY: y }, target: stage });
}
function fireClick(stage, { x = 0, y = 0 } = {}) {
  stage._fire('click', { evt: { clientX: x, clientY: y }, target: stage });
}
function fireContextMenu(stage, { x = 0, y = 0 } = {}) {
  stage._fire('contextmenu', { evt: { clientX: x, clientY: y, preventDefault: vi.fn() }, target: stage });
}
function fireTouch(stage, evtName, touches) {
  stage._fire(evtName, { evt: { touches } });
}

let rig, dispose;
afterEach(() => {
  dispose?.(); dispose = null;
  rig?.stage.destroy(); rig?.container.remove(); rig = null;
  strokeCancel();
  pendingPlacementSignal.value = null;
  vi.useRealTimers();
});

// ─── mousedown ───────────────────────────────────────────────────────────────

describe('mousedown handler', () => {
  it('ignores middle-click', () => {
    rig = makeRig({ activeTool: 'wall' });
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { button: 1 });
    expect(strokeIsActive()).toBe(false);
  });

  it('ignores left-click while space is held (pan mode)', () => {
    rig = makeRig({ activeTool: 'wall' });
    rig.mr._spaceDown = true;
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { button: 0 });
    expect(strokeIsActive()).toBe(false);
  });

  it('does not start a stroke when activeTool is pointer', () => {
    rig = makeRig({ activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 50, y: 50 });
    expect(strokeIsActive()).toBe(false);
  });

  it('records area-selection start point when areaSelectionMode is on', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr.areaSelectionMode = true;
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 80, y: 60 });
    expect(rig.mr.areaSelectionStart).toEqual({ x: 80, y: 60 });
    expect(rig.mr.areaSelectionCurrent).toEqual({ x: 80, y: 60 });
    expect(rig.mr.render).toHaveBeenCalled();
  });

  it('starts a stroke for a drawing tool', () => {
    rig = makeRig({ activeTool: 'line' });
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 0, y: 0 });
    expect(strokeIsActive()).toBe(true);
  });
});

// ─── mousemove ───────────────────────────────────────────────────────────────

describe('mousemove handler', () => {
  it('updates area-selection rectangle while a selection is in progress', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr.areaSelectionMode = true;
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 10, y: 10 });
    rig.mr.render.mockClear();
    fireMouseMove(rig.stage, { x: 90, y: 70 });
    expect(rig.mr.areaSelectionCurrent).toEqual({ x: 90, y: 70 });
    expect(rig.mr.render).toHaveBeenCalled();
  });

  it('is a no-op when no stroke is active and no area-select is in progress', () => {
    rig = makeRig({ activeTool: 'line' });
    dispose = setupTools(rig.mr);
    fireMouseMove(rig.stage, { x: 50, y: 50 });
    expect(rig.mr.render).not.toHaveBeenCalled();
  });

  it('updates _measureEnd while the measure tool is in flight', () => {
    rig = makeRig({ activeTool: 'measure' });
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 0, y: 0 });
    fireMouseMove(rig.stage, { x: 120, y: 80 });
    expect(rig.mr._measureEnd).toEqual({ x: 120, y: 80 });
  });
});

// ─── mouseup ─────────────────────────────────────────────────────────────────

describe('mouseup handler', () => {
  it('ignores non-left-click while a stroke is active', async () => {
    rig = makeRig({ activeTool: 'line' });
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 0, y: 0 });
    fireMouseUp(rig.stage, { x: 40, y: 0, button: 2 });
    await Promise.resolve();
    expect(rig.mr.state.addDrawing).not.toHaveBeenCalled();
    expect(strokeIsActive()).toBe(true);
  });

  it('completes an in-flight area-selection on left-up', async () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr.areaSelectionMode = true;
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 10, y: 10 });
    fireMouseUp(rig.stage, { x: 80, y: 80, button: 0 });
    await Promise.resolve();
    expect(rig.mr.completeAreaSelection).toHaveBeenCalledTimes(1);
  });

  it('ignores area-selection mouseup on non-left button', async () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr.areaSelectionMode = true;
    dispose = setupTools(rig.mr);
    fireMouseDown(rig.stage, { x: 10, y: 10 });
    fireMouseUp(rig.stage, { x: 80, y: 80, button: 2 });
    await Promise.resolve();
    expect(rig.mr.completeAreaSelection).not.toHaveBeenCalled();
  });
});

// ─── click ───────────────────────────────────────────────────────────────────

describe('click handler', () => {
  it('does nothing when isDragging', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr.isDragging = true;
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 50, y: 50 });
    expect(rig.mr.setSelectedToken).not.toHaveBeenCalled();
  });

  it('consumes a pending item-token placement and clears the signal', async () => {
    rig = makeRig({ activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    pendingPlacementSignal.value = { kind: 'item-token', itemId: 'item-xyz' };
    fireClick(rig.stage, { x: 80, y: 80 });
    // spawnItemToken is awaited; the signal clears synchronously before the await.
    expect(pendingPlacementSignal.value).toBeNull();
    await Promise.resolve();
  });

  it('applies a facing update and exits facing mode on click', async () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.tokens.set('tok-1', { id: 'tok-1', col: 1, row: 1, size: 1 });
    rig.mr._facingModeTokenId = 'tok-1';
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 200, y: 60 });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.updateToken).toHaveBeenCalledTimes(1);
    const [id, patch] = rig.mr.state.updateToken.mock.calls[0];
    expect(id).toBe('tok-1');
    expect(typeof patch.facing).toBe('number');
    expect(rig.mr._exitFacingMode).toHaveBeenCalled();
  });

  it('broadcasts a ping and exits ping mode on click', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.mr._pingMode = true;
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 100, y: 100 });
    expect(rig.mr.broadcastPing).toHaveBeenCalledWith(100, 100);
    expect(rig.mr._pingMode).toBe(false);
  });

  it('selects a token under the pointer in pointer mode', () => {
    rig = makeRig({ activeTool: 'pointer' });
    // Square grid, cell_px 40, token at col 1 row 1 -> center (60, 60).
    rig.tokens.set('tok-1', { id: 'tok-1', col: 1, row: 1, size: 1 });
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 60, y: 60 });
    expect(rig.mr.setSelectedToken).toHaveBeenCalledWith('tok-1');
  });

  it('clears selection when clicking empty space in pointer mode', () => {
    rig = makeRig({ activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 380, y: 290 });
    expect(rig.mr.setSelectedToken).toHaveBeenCalledWith(null);
  });

  it('ignores click in non-pointer drawing modes', () => {
    rig = makeRig({ activeTool: 'wall' });
    dispose = setupTools(rig.mr);
    fireClick(rig.stage, { x: 100, y: 100 });
    expect(rig.mr.setSelectedToken).not.toHaveBeenCalled();
  });
});

// ─── contextmenu ────────────────────────────────────────────────────────────

describe('contextmenu handler', () => {
  it('routes to token context menu when a token is under the cursor', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.tokens.set('tok-1', { id: 'tok-1', col: 1, row: 1, size: 1 });
    dispose = setupTools(rig.mr);
    fireContextMenu(rig.stage, { x: 60, y: 60 });
    expect(rig.mr.showTokenContextMenu).toHaveBeenCalled();
    expect(rig.mr.showPinContextMenu).not.toHaveBeenCalled();
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
  });

  it('routes to pin context menu when only a pin is under the cursor', () => {
    rig = makeRig({ activeTool: 'pointer' });
    rig.pins.set('pin-1', { id: 'pin-1', col: 2, row: 2, label: 'X' });
    dispose = setupTools(rig.mr);
    // Square grid, cell_px 40, pin col/row 2 -> center (100, 100).
    fireContextMenu(rig.stage, { x: 100, y: 100 });
    expect(rig.mr.showPinContextMenu).toHaveBeenCalled();
    expect(rig.mr.showTokenContextMenu).not.toHaveBeenCalled();
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
  });

  it('falls through to the GM map menu on empty space when caller is GM', () => {
    rig = makeRig({ isGM: true, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireContextMenu(rig.stage, { x: 200, y: 200 });
    expect(rig.mr.showMapContextMenu).toHaveBeenCalled();
  });

  it('shows no menu on empty space for non-GM players', () => {
    rig = makeRig({ isGM: false, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireContextMenu(rig.stage, { x: 200, y: 200 });
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
    expect(rig.mr.showTokenContextMenu).not.toHaveBeenCalled();
    expect(rig.mr.showPinContextMenu).not.toHaveBeenCalled();
  });
});

// ─── long-press ─────────────────────────────────────────────────────────────

describe('touch long-press', () => {
  it('opens the context menu after a 500ms hold with no drift', () => {
    vi.useFakeTimers();
    rig = makeRig({ isGM: true, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireTouch(rig.stage, 'touchstart', [{ clientX: 200, clientY: 150 }]);
    vi.advanceTimersByTime(500);
    expect(rig.mr.showMapContextMenu).toHaveBeenCalled();
  });

  it('cancels long-press when the finger drifts beyond the tolerance', () => {
    vi.useFakeTimers();
    rig = makeRig({ isGM: true, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireTouch(rig.stage, 'touchstart', [{ clientX: 200, clientY: 150 }]);
    fireTouch(rig.stage, 'touchmove',  [{ clientX: 220, clientY: 180 }]); // > 10px drift
    vi.advanceTimersByTime(500);
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
  });

  it('cancels long-press on touchend before the timer fires', () => {
    vi.useFakeTimers();
    rig = makeRig({ isGM: true, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireTouch(rig.stage, 'touchstart', [{ clientX: 200, clientY: 150 }]);
    fireTouch(rig.stage, 'touchend',   []);
    vi.advanceTimersByTime(500);
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
  });

  it('cancels long-press when a second finger goes down (pinch)', () => {
    vi.useFakeTimers();
    rig = makeRig({ isGM: true, activeTool: 'pointer' });
    dispose = setupTools(rig.mr);
    fireTouch(rig.stage, 'touchstart', [{ clientX: 200, clientY: 150 }]);
    fireTouch(rig.stage, 'touchstart', [{ clientX: 200, clientY: 150 }, { clientX: 240, clientY: 160 }]);
    vi.advanceTimersByTime(500);
    expect(rig.mr.showMapContextMenu).not.toHaveBeenCalled();
  });
});
