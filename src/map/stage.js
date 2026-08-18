/**
 * stage.js - Konva Stage bootstrap.
 *
 * After phase 7 the host element is a plain `<div id="map-canvas">`,
 * not a `<canvas>`. The Stage mounts directly into it, filling the
 * div's client box.
 */

import Konva from 'konva';
import { activeMapIdSignal, mapsSignal } from '../state/signals.js';
import { ZOOM_MIN, ZOOM_MAX } from './input/pan-zoom.js';

const FIT_MARGIN = 0.95;

export function createStage(mr) {
  const host = mr.canvas;
  if (!host) return;
  if (!document.createElement('canvas').getContext?.('2d')) return;
  const rect = host.getBoundingClientRect();
  const stage = new Konva.Stage({
    container: host,
    width: rect.width || 800,
    height: rect.height || 600,
  });
  mr.stage = stage;
  mr.stageContainer = host;
}

export function destroyStage(mr) {
  mr.stage?.destroy();
  mr.stage = null;
  mr.stageContainer = null;
}

export function resizeStage(mr) {
  if (!mr.stage || !mr.canvas) return;
  const rect = mr.canvas.getBoundingClientRect();
  mr.stage.width(rect.width || 800);
  mr.stage.height(rect.height || 600);
}

/**
 * Apply the current pan/zoom viewport to the Stage so its layers
 * paint in the same world space. Called from `MapRenderer.render()`
 * once per frame.
 */
export function syncStageTransform(mr) {
  if (!mr.stage) return;
  mr.stage.scaleX(mr.zoom);
  mr.stage.scaleY(mr.zoom);
  mr.stage.x(mr.panX);
  mr.stage.y(mr.panY);
}

/**
 * Frame the active map inside the stage at a sensible zoom and centre
 * it. Runs on first map load, on switch-to-a-different-map, and on
 * resize() before the user has touched pan/zoom. Once the user pans or
 * zooms, `mr._userFramedViewport` flips true and the caller decides
 * whether to call this again (resize() respects the flag; the map-id
 * effect clears it on every map change).
 *
 * No-op when there's no active map, the map has zero dimensions, or
 * the stage hasn't been sized yet (host element with 0×0 box).
 */
export function fitToViewport(mr) {
  if (!mr.stage) return;
  const id = activeMapIdSignal.value;
  if (!id) return;
  const map = mapsSignal.value.get(id);
  if (!map) return;
  const w = map.width_cells * map.cell_px;
  const h = map.height_cells * map.cell_px;
  if (!(w > 0 && h > 0)) return;
  const sw = mr.stage.width();
  const sh = mr.stage.height();
  if (!(sw > 0 && sh > 0)) return;
  const fit = Math.min(sw / w, sh / h) * FIT_MARGIN;
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit));
  mr.zoom = zoom;
  mr.panX = (sw - w * zoom) / 2;
  mr.panY = (sh - h * zoom) / 2;
  mr.render();
}
