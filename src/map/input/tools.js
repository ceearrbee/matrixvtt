/**
 * src/map/input/tools.js - Konva-stage tool input pipeline.
 *
 * Stage-event wiring + tool-mode dispatch. Pure stroke math (state,
 * builders) lives in `./strokes.js` and is re-exported from here so
 * existing import paths keep working without touching every caller.
 */
import { tokenAt, wallAt, templateAt, pinAt, strokeHitTest } from '../hit-test.js';
import { getTokenRadius } from '../token-geometry.js';
import { pendingPlacementSignal } from '../../state/signals.js';
import { spawnItemToken } from '../../ui/tables/loot-actions.js';
import { clampToMap } from './clamp-coords.js';
import { showErrorNotification } from '../../utils/errorHandling.js';
import {
  strokeBegin, strokeUpdate, strokeFinish, strokeCancel,
  strokeIsActive, strokeStart, strokeCurrent, strokePencilPoints,
  buildStroke, buildWall, buildTemplate, buildLight,
} from './strokes.js';

// Re-export the stroke API at the historical path so callers that
export {
  strokeBegin, strokeUpdate, strokeFinish, strokeCancel,
  strokeIsActive, strokeStart, strokeCurrent, strokePencilPoints,
  buildStroke, buildWall, buildTemplate, buildLight,
};

function worldCoords(mr, e) {
  // Real Konva input keeps `stage.getPointerPosition()` in sync; in
  // tests that fire events synthetically, fall back to evt.client*
  // minus the container's bounding rect.
  const p = mr.stage?.getPointerPosition?.();
  if (p && (p.x !== 0 || p.y !== 0)) {
    return { x: (p.x - mr.panX) / mr.zoom, y: (p.y - mr.panY) / mr.zoom };
  }
  if (e?.evt && typeof e.evt.clientX === 'number') {
    const rect = mr.stage.container().getBoundingClientRect();
    const sx = e.evt.clientX - rect.left;
    const sy = e.evt.clientY - rect.top;
    return { x: (sx - mr.panX) / mr.zoom, y: (sy - mr.panY) / mr.zoom };
  }
  return { x: 0, y: 0 };
}

function onMouseDown(mr, e) {
  const ev = e.evt;
  if (ev.button === 1 || (ev.button === 0 && mr._spaceDown)) return;
  if (mr.areaSelectionMode) {
    const { x, y } = worldCoords(mr, e);
    mr.areaSelectionStart = { x, y };
    mr.areaSelectionCurrent = { x, y };
    mr.render();
    return;
  }
  if (mr.activeTool === 'pointer') return;
  const { x, y } = worldCoords(mr, e);
  _startToolAction(mr, x, y);
}

function onMouseMove(mr, e) {
  if (mr.areaSelectionMode && mr.areaSelectionStart) {
    const { x, y } = worldCoords(mr, e);
    mr.areaSelectionCurrent = { x, y };
    mr.render();
    return;
  }
  if (!strokeIsActive()) return;
  const { x, y } = worldCoords(mr, e);
  if (mr.activeTool === 'measure') { mr._measureEnd = { x, y }; }
  strokeUpdate({ x, y }, { track: mr.activeTool === 'pencil' });
  mr.render();
}

async function onMouseUp(mr, e) {
  if (mr.areaSelectionMode && mr.areaSelectionStart) {
    if (e.evt.button !== 0) return;
    await mr.completeAreaSelection?.();
    const c = mr.stage.container();
    if (c?.style) c.style.cursor = 'default';
    return;
  }
  if (!strokeIsActive()) return;
  if (e.evt.button !== 0) return;
  const { x, y } = worldCoords(mr, e);
  strokeUpdate({ x, y }, { track: mr.activeTool === 'pencil' });
  await _finalizeToolAction(mr);
}

/**
 * One-shot placement clicks ("Drop on map" from a loot roll, "Add
 * token" from the Scene toolbar). Returns true when the click was
 * consumed so onClick skips the pointer / facing / ping flow.
 */
export async function consumePendingPlacement(mr, x, y) {
  const pending = pendingPlacementSignal.value;
  if (!pending) return false;
  const map = mr.state.map;
  const px = map?.cell_px || 40;
  const { col, row } = clampToMap(map, x / px, y / px);

  if (pending.kind === 'item-token' && mr._ui) {
    pendingPlacementSignal.value = null;
    try { await spawnItemToken(mr._ui, pending.itemId, { col, row }); }
    catch (err) {
      window.dispatchEvent(new CustomEvent('vtt:error', { detail: { message: 'Failed to drop item', error: err } }));
    }
    mr.render();
    return true;
  }
  if (pending.kind === 'new-token') {
    pendingPlacementSignal.value = null;
    mr.showAddTokenDialog?.(col, row);
    mr.render();
    return true;
  }
  return false;
}

async function onClick(mr, e) {
  if (mr.isDragging) return;
  const { x, y } = worldCoords(mr, e);

  // Synchronous guard: awaiting unconditionally would defer the ping /
  // selection flow to a microtask, and callers observe those synchronously.
  if (pendingPlacementSignal.value) {
    if (await consumePendingPlacement(mr, x, y)) return;
  }

  if (mr._facingModeTokenId) {
    const t = mr.state.tokens.get(mr._facingModeTokenId);
    if (t) {
      const px = mr.state.map?.cell_px || 40;
      const tx = t.x !== undefined ? t.x : (t.col + (t.size || 1) / 2) * px;
      const ty = t.y !== undefined ? t.y : (t.row + (t.size || 1) / 2) * px;
      const angle = Math.atan2(y - ty, x - tx);
      try { await mr.state.updateToken(t.id, { ...t, facing: _safeCoord(angle) }); }
      catch (err) {
        window.dispatchEvent(new CustomEvent('vtt:error', { detail: { message: 'Failed to set facing', error: err } }));
      }
    }
    mr._exitFacingMode?.();
    mr.render();
    return;
  }
  if (mr._pingMode) {
    mr.broadcastPing(x, y);
    mr._pingMode = false;
    mr.render();
    return;
  }
  if (mr.activeTool !== 'pointer') return;
  const t = tokenAt({
    tokens: mr.state.tokens, map: mr.state.map,
    gridType: mr.state.settings?.grid_type, x, y,
    getRadius: getTokenRadius,
  });
  mr.setSelectedToken(t ? t.id : null);
}

// Angle sanitiser for Matrix JSON - NaN / Infinity round to 0,
// finite numbers keep two decimals of precision.
function _safeCoord(val) {
  if (typeof val !== 'number' || !isFinite(val) || isNaN(val)) return 0;
  return Number(val.toFixed(2));
}

function dispatchContextMenu(mr, screenX, screenY, worldX, worldY) {
  const cellPx = mr.state.map?.cell_px ?? 40;
  const isGM = !!mr.state.isGM?.();
  // Tokens take priority - a pin under a token would otherwise be
  // unreachable through the right-click menu.
  const token = tokenAt({
    tokens: mr.state.tokens, map: mr.state.map,
    gridType: mr.state.settings?.grid_type, x: worldX, y: worldY,
    getRadius: getTokenRadius,
  });
  if (token) { mr.showTokenContextMenu?.(token, screenX, screenY); return; }
  const pin = pinAt({ pins: mr.state.pins, x: worldX, y: worldY, cellPx, isGM });
  if (pin) { mr.showPinContextMenu?.(pin, screenX, screenY); return; }
  if (isGM) {
    // Clamp to map bounds: a right-click past the panned origin can
    // yield negative world coords and the token schema requires col
    // / row >= 0. Without this the resulting "Add Token Here" form
    // would silently fail validation on submit.
    const { col, row } = clampToMap(mr.state.map, worldX / cellPx, worldY / cellPx);
    mr.showMapContextMenu?.(screenX, screenY, col, row);
  }
}

function onContextMenu(mr, e) {
  e.evt?.preventDefault?.();
  const { x, y } = worldCoords(mr, e);
  dispatchContextMenu(mr, e.evt?.clientX ?? 0, e.evt?.clientY ?? 0, x, y);
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_TOLERANCE_PX = 10;

// Touch long-press: a single-finger hold for ~500ms with <10px drift
// opens the same context menu as right-click. Cancelled by drift,
// touchend, or a second finger going down (pinch).
function createLongPressTracker(mr) {
  let timer = null;
  let start = null;

  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    start = null;
  };

  return {
    cancel,
    onTouchStart(e) {
      if (e.evt?.touches?.length !== 1) { cancel(); return; }
      const t = e.evt.touches[0];
      start = { clientX: t.clientX, clientY: t.clientY };
      timer = setTimeout(() => {
        const { x, y } = worldCoords(mr, e);
        dispatchContextMenu(mr, start.clientX, start.clientY, x, y);
        cancel();
      }, LONG_PRESS_MS);
    },
    onTouchMove(e) {
      if (!start) return;
      const t = e.evt?.touches?.[0];
      if (!t) return;
      const dx = t.clientX - start.clientX;
      const dy = t.clientY - start.clientY;
      if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) cancel();
    },
    onEnd: cancel,
  };
}

export function setupTools(mr) {
  const stage = mr.stage;
  if (!stage) return () => {};
  const longPress = createLongPressTracker(mr);

  stage.on('mousedown.tools',   (e) => onMouseDown(mr, e));
  stage.on('mousemove.tools',   (e) => onMouseMove(mr, e));
  stage.on('mouseup.tools',     (e) => onMouseUp(mr, e));
  stage.on('click.tools',       (e) => onClick(mr, e));
  stage.on('contextmenu.tools', (e) => onContextMenu(mr, e));
  stage.on('touchstart.tools',  longPress.onTouchStart);
  stage.on('touchmove.tools',   longPress.onTouchMove);
  stage.on('touchend.tools touchcancel.tools', longPress.onEnd);

  return () => {
    longPress.cancel();
    stage.off('mousedown.tools mousemove.tools mouseup.tools click.tools contextmenu.tools touchstart.tools touchmove.tools touchend.tools touchcancel.tools');
  };
}

function _startToolAction(mr, x, y) {
  if (mr.activeTool === 'erase') return _eraseAt(mr, x, y);
  if (mr.activeTool === 'light') return placeLightAt(mr, x, y);
  if (mr.activeTool === 'measure') {
    mr._measureStart = { x, y }; mr._measureEnd = { x, y };
    strokeBegin({ x, y });
    return;
  }
  if (mr.activeTool === 'wall' && _toggleDoorAt(mr, x, y)) return;
  strokeBegin({ x, y }, { track: mr.activeTool === 'pencil' });
}

export async function placeLightAt(mr, x, y) {
  if (!mr.state?.isGM?.()) return;
  const light = buildLight(mr, x, y);
  if (!light) return;
  await mr.state.addLight(light).catch(showErrorNotification);
  mr.render?.();
}

function _toggleDoorAt(mr, x, y) {
  if (!mr.state?.isGM?.() || !mr.state.walls) return false;
  const hit = wallAt({ walls: mr.state.walls, x, y });
  if (!hit) return false;
  mr.state.updateWall(hit.id, { blocks_sight: !hit.blocks_sight }).catch(showErrorNotification);
  return true;
}

async function _finalizeToolAction(mr) {
  const { start, current, pencilPoints } = strokeFinish();
  if (mr.activeTool === 'wall') {
    if (mr.state?.isGM?.()) {
      const wall = buildWall(mr, start, current);
      if (wall) await mr.state.addWall(wall).catch(showErrorNotification);
    }
  } else if (mr.activeTool === 'template-circle') {
    if (mr.state?.isGM?.()) {
      const tpl = buildTemplate(mr, start, current);
      if (tpl) await mr.state.addTemplate(tpl).catch(showErrorNotification);
    }
  } else if (mr.activeTool === 'measure') {
    mr._measureStart = null; mr._measureEnd = null;
  } else if (mr.state?.isGM?.()) {
    const s = buildStroke(mr, start, current, pencilPoints);
    if (s) await mr.state.addDrawing(s).catch(showErrorNotification);
  }
  mr.render();
}

async function _eraseAt(mr, x, y) {
  if (!mr.state?.isGM?.()) return;
  const hit = mr.state.drawings.find((s) => strokeHitTest(s, x, y));
  if (hit) return mr.state.removeDrawing(hit.id);
  if (!mr.state?.isGM?.()) return;
  const wallHit = wallAt({ walls: mr.state.walls, x, y });
  if (wallHit) return mr.state.removeWall(wallHit.id);
  const tplHit = templateAt({
    templates: mr.state.templates, x, y,
    cellPx: mr.state.map?.cell_px || 40,
  });
  if (tplHit) return mr.state.removeTemplate(tplHit.id);
}
