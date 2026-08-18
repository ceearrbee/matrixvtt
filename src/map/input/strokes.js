/**
 * Stroke state + builders. Holds the in-progress stroke for whatever
 * drawing/wall/template tool is currently active, plus the pure
 * helpers that turn (start, end) pairs into wire-safe Matrix-event
 * shapes.
 *
 * Split out of `src/map/input/tools.js`: stroke logic is
 * pure / module-state; the tools file deals with stage event wiring
 * and tool-mode dispatch.
 */
import { TOKEN_COLORS } from '../../utils/ui-constants.js';
import { nearestHexVertex } from '../../utils/hexGrid.js';

let _active = false;
let _start = null;
let _current = null;
let _pencilPoints = [];

export function strokeBegin(point, { track = false } = {}) {
  _active = true;
  _start = point;
  _current = point;
  _pencilPoints = track ? [point] : [];
}

export function strokeUpdate(point, { track = false } = {}) {
  if (!_active) return;
  _current = point;
  if (track) _pencilPoints.push(point);
}

export function strokeFinish() {
  const snap = { start: _start, current: _current, pencilPoints: _pencilPoints.slice() };
  strokeCancel();
  return snap;
}

export function strokeCancel() {
  _active = false;
  _start = null;
  _current = null;
  _pencilPoints = [];
}

export function strokeIsActive() { return _active; }
export function strokeStart() { return _start; }
export function strokeCurrent() { return _current; }
export function strokePencilPoints() { return _pencilPoints; }

/**
 * Safely round float coordinates to avoid Matrix strict-JSON
 * (M_BAD_JSON) errors. Matrix rejects Infinity / NaN / non-finite
 * floats on send; toFixed(2) gives clean decimals before sync.
 */
function _safeCoord(val) {
  if (typeof val !== 'number' || !isFinite(val) || isNaN(val)) return 0;
  return Number(val.toFixed(2));
}

function _safePoint(p) {
  if (!p) return { x: 0, y: 0 };
  return { x: _safeCoord(p.x), y: _safeCoord(p.y) };
}

export function buildStroke(mr, start, end, pencilPoints = null) {
  const safeWidth = typeof mr.drawWidth === 'number' && isFinite(mr.drawWidth) ? _safeCoord(mr.drawWidth) : 3;
  const common = { id: 's-' + Date.now(), color: mr.drawColor, width: safeWidth };

  const sStart = _safePoint(start);
  const sEnd = _safePoint(end);

  if (mr.activeTool === 'pencil') {
    const rawPoints = pencilPoints ?? mr.drawing?.pencilPoints ?? _pencilPoints;
    const points = (rawPoints || []).map(_safePoint);
    return { ...common, type: 'pencil', points };
  }
  if (mr.activeTool === 'line') return { ...common, type: 'line', points: [sStart, sEnd] };
  if (mr.activeTool === 'rect') return {
    ...common, type: 'rect',
    x: _safeCoord(Math.min(sStart.x, sEnd.x)),
    y: _safeCoord(Math.min(sStart.y, sEnd.y)),
    w: _safeCoord(Math.abs(sEnd.x - sStart.x)),
    h: _safeCoord(Math.abs(sEnd.y - sStart.y)),
  };
  if (mr.activeTool === 'circle') return {
    ...common, type: 'circle', x: sStart.x, y: sStart.y,
    r: _safeCoord(Math.hypot(sEnd.x - sStart.x, sEnd.y - sStart.y)),
  };
  return null;
}

export function buildWall(mr, start, end) {
  if (!start || !end) return null;
  const px = mr.state.map?.cell_px || 40;
  const gridType = mr.state.settings?.grid_type;
  const snap = (gridType === 'hex_pointy' || gridType === 'hex_flat')
    ? (p) => nearestHexVertex(p, { size: px, orientation: gridType === 'hex_flat' ? 'flat' : 'pointy' })
    : (p) => ({ x: Math.round(p.x / px) * px, y: Math.round(p.y / px) * px });
  const p1 = snap(start);
  const p2 = snap(end);
  if (p1.x === p2.x && p1.y === p2.y) return null;
  return { id: 'wall-' + Date.now(), p1, p2, blocks_sight: true, blocks_movement: true };
}

// Default illumination: three cells of radius, a torch-like pool that
// reads clearly at any zoom without flooding the room.
const LIGHT_RADIUS_CELLS = 3;

export function buildLight(mr, x, y) {
  const map = mr.state?.map;
  if (!map) return null;
  const cellPx = map.cell_px || 40;
  return {
    id: 'light-' + Date.now(),
    map_id: map.id,
    x, y,
    radius_px: cellPx * LIGHT_RADIUS_CELLS,
  };
}

export function buildTemplate(mr, start, end) {
  if (!start || !end) return null;
  const cellPx = mr.state.map?.cell_px || 40;
  const dx = end.x - start.x, dy = end.y - start.y;
  const radiusCells = Math.max(1, Math.round(Math.hypot(dx, dy) / cellPx));
  return {
    id: 'tpl-' + Date.now(),
    shape: 'circle',
    origin: { col: Math.round(start.x / cellPx), row: Math.round(start.y / cellPx) },
    radius: radiusCells,
    color: mr.drawColor || TOKEN_COLORS.AREA_HIDE,
    creator_id: mr.state?.widgetManager?.userId ?? null,
  };
}

