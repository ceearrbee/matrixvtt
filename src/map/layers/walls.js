/**
 * src/map/layers/walls.js - Konva walls layer (GM visual only).
 *
 * Draws each wall segment as a
 * Konva.Line; open doors (`blocks_sight === false`) render dashed +
 * greenish, solid sight-blockers render orange. Also draws the
 * in-progress wall preview while the wall tool is dragging - that
 * state lives on `mr.drawing`, so MapRenderer.render() calls sync()
 * per frame.
 *
 * The line-of-sight darkness mask (non-GM vision cone) stays on
 * Canvas2D for now - that's phase 5's fog problem.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { wallsSignal, activeMapIdSignal, mapsSignal } from '../../state/signals.js';

const DOOR_COLOR = 'rgba(120, 200, 140, 0.7)';
const WALL_COLOR = 'rgba(255, 140, 60, 0.7)';
const PORTAL_CLOSED_COLOR = 'rgba(255, 200, 90, 0.9)';
const PREVIEW_COLOR = 'rgba(255, 200, 120, 0.9)';

export function createWallsLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: true });
  stage.add(layer);

  const lines = new Map();

  const preview = new Konva.Line({
    name: 'preview',
    listening: false, visible: false, stroke: PREVIEW_COLOR, lineCap: 'round',
  });
  layer.add(preview);

  let _lastCommittedSig = '';

  function isGM() {
    return !!mr.state?.isGM?.();
  }

  function syncCommitted() {
    const walls = wallsSignal.value;
    const activeId = activeMapIdSignal.value;
    const gm = isGM();
    const zoom = Number.isFinite(mr.zoom) && mr.zoom > 0 ? mr.zoom : 1;
    let sig = `${gm}|${activeId || ''}|z${zoom};`;
    if (gm && walls) {
      for (const [id, w] of walls) {
        if (!w?.p1 || !w?.p2 || w.map_id !== activeId) continue;
        if (!Number.isFinite(w.p1.x) || !Number.isFinite(w.p1.y) ||
            !Number.isFinite(w.p2.x) || !Number.isFinite(w.p2.y)) continue;
        sig += `${id}|${w.p1.x}|${w.p1.y}|${w.p2.x}|${w.p2.y}|${w.is_portal}|${w.is_open}|${w.blocks_sight};`;
      }
    }
    if (sig === _lastCommittedSig) return;
    _lastCommittedSig = sig;

    const keep = new Set();
    if (gm && walls) {
      for (const [id, w] of walls) {
        if (!w?.p1 || !w?.p2) continue;
        if (!Number.isFinite(w.p1.x) || !Number.isFinite(w.p1.y) ||
            !Number.isFinite(w.p2.x) || !Number.isFinite(w.p2.y)) continue;
        if (w.map_id !== activeId) continue;
        keep.add(id);
        let line = lines.get(id);
        if (!line) {
          line = new Konva.Line({ listening: false, lineCap: 'round', hitStrokeWidth: 16 });
          lines.set(id, line);
          layer.add(line);
        }
        const isPortalNow = w.is_portal === true && isGM();
        line.listening(isPortalNow);
        if (isPortalNow && !line._portalClickBound) {
          line.on('click tap', () => {
            const current = wallsSignal.value?.get(id);
            if (!current?.is_portal) return;
            const nextOpen = !current.is_open;
            mr.state?.updateWall?.(id, {
              is_open: nextOpen,
              blocks_sight: !nextOpen,
              blocks_movement: !nextOpen,
            });
          });
          line._portalClickBound = true;
        }
        const isPortal = w.is_portal === true;
        const isOpen = isPortal ? w.is_open === true : w.blocks_sight === false;
        line.points([w.p1.x, w.p1.y, w.p2.x, w.p2.y]);
        line.strokeWidth((isPortal && !isOpen ? 3 : 2) / zoom);
        if (isPortal) {
          line.stroke(isOpen ? DOOR_COLOR : PORTAL_CLOSED_COLOR);
          line.dash(isOpen ? [4 / zoom, 4 / zoom] : []);
        } else {
          line.stroke(isOpen ? DOOR_COLOR : WALL_COLOR);
          line.dash(isOpen ? [4 / zoom, 4 / zoom] : []);
        }
      }
    }
    for (const [id, line] of lines) {
      if (!keep.has(id)) {
        line.destroy();
        lines.delete(id);
      }
    }
  }

  function syncPreview() {
    const drawing = mr.drawing;
    const show = isGM()
      && mr.activeTool === 'wall'
      && drawing?.isActive && drawing.start && drawing.current
      && Number.isFinite(drawing.start.x) && Number.isFinite(drawing.start.y)
      && Number.isFinite(drawing.current.x) && Number.isFinite(drawing.current.y);
    if (!show) { preview.visible(false); return; }
    const zoom = Number.isFinite(mr.zoom) && mr.zoom > 0 ? mr.zoom : 1;
    preview.visible(true);
    preview.points([drawing.start.x, drawing.start.y, drawing.current.x, drawing.current.y]);
    preview.strokeWidth(2 / zoom);
    preview.dash([6 / zoom, 4 / zoom]);
  }

  function sync() {
    const activeId = activeMapIdSignal.value;
    const map = mr.state?.map || (activeId ? mapsSignal.value?.get(activeId) : null);
    if (map && typeof map.width_cells === 'number' && typeof map.height_cells === 'number'
        && typeof map.cell_px === 'number') {
      const w = map.width_cells * map.cell_px;
      const h = map.height_cells * map.cell_px;
      layer.clipFunc((ctx) => { ctx.rect(0, 0, w, h); });
    } else {
      layer.clipFunc(null);
    }
    syncCommitted();
    syncPreview();
    layer.batchDraw();
  }

  const dispose = effect(() => {
    wallsSignal.value;
    activeMapIdSignal.value;
    mapsSignal.value;
    sync();
  });

  return { layer, lines, dispose, sync };
}
