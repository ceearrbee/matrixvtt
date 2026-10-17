/**
 * src/map/layers/drawings.js - Konva drawings layer.
 *
 * One Konva shape per committed stroke
 * from `drawingsSignal`; an extra transient preview shape while the
 * user is mid-stroke (driven by `mr.drawing` class state, which isn't
 * in a signal). `MapRenderer.render()` calls `sync()` every frame so
 * the preview follows the pointer.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { drawingsSignal, activeMapIdSignal, mapsSignal } from '../../state/signals.js';

export function createDrawingsLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const shapes = new Map();

  let previewRef = makeShape({ type: 'pencil', color: '#fff', width: 1, points: [] });
  previewRef.name('preview');
  previewRef.visible(false);
  layer.add(previewRef);

  let _lastCommittedSig = '';

  function applyStroke(shape, s) {
    shape.stroke(s.color || '#fff');
    shape.strokeWidth(Number.isFinite(s.width) && s.width > 0 ? s.width : 1);
    shape.lineCap('round');
    shape.lineJoin('round');
    if (s.type === 'pencil' || s.type === 'line') {
      const pts = [];
      if (Array.isArray(s.points)) {
        for (const p of s.points) {
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            pts.push(p.x, p.y);
          }
        }
      }
      shape.points(pts);
      shape.closed(false);
    } else if (s.type === 'rect') {
      const x = Number.isFinite(s.x) ? s.x : 0;
      const y = Number.isFinite(s.y) ? s.y : 0;
      const w = Number.isFinite(s.w) && s.w >= 0 ? s.w : 0;
      const h = Number.isFinite(s.h) && s.h >= 0 ? s.h : 0;
      shape.position({ x, y });
      shape.size({ width: w, height: h });
      shape.fillEnabled(false);
    } else if (s.type === 'circle') {
      const x = Number.isFinite(s.x) ? s.x : 0;
      const y = Number.isFinite(s.y) ? s.y : 0;
      const r = Number.isFinite(s.r) && s.r >= 0 ? s.r : 0;
      shape.position({ x, y });
      shape.radius(r);
      shape.fillEnabled(false);
    }
  }

  function makeShape(s) {
    let shape;
    if (s.type === 'rect') shape = new Konva.Rect({ listening: false });
    else if (s.type === 'circle') shape = new Konva.Circle({ listening: false });
    else shape = new Konva.Line({ listening: false });
    applyStroke(shape, s);
    return shape;
  }

  function syncCommitted() {
    const list = drawingsSignal.value || [];
    const activeId = activeMapIdSignal.value;
    let sig = `${activeId || ''};`;
    for (const s of list) {
      if (!s?.id || s.map_id !== activeId) continue;
      sig += `${s.id}|${s.type}|${s.color}|${s.width}|${s.x}|${s.y}|${s.w}|${s.h}|${s.r}|${s.points ? s.points.length : 0};`;
    }
    if (sig === _lastCommittedSig) return;
    _lastCommittedSig = sig;

    const keep = new Set();
    for (const s of list) {
      if (!s?.id) continue;
      if (s.map_id !== activeId) continue;
      keep.add(s.id);
      let shape = shapes.get(s.id);
      const desiredCtor = shapeCtor(s.type);
      if (shape && shape.constructor !== desiredCtor) {
        shape.destroy();
        shape = null;
      }
      if (!shape) {
        shape = makeShape(s);
        shapes.set(s.id, shape);
        layer.add(shape);
      } else {
        applyStroke(shape, s);
      }
    }
    for (const [id, shape] of shapes) {
      if (!keep.has(id)) {
        shape.destroy();
        shapes.delete(id);
      }
    }
  }

  function syncPreview() {
    const { isActive, start, current } = mr.drawing || {};
    if (!isActive || !start || !current || typeof mr._buildStroke !== 'function') {
      previewRef.visible(false);
      return;
    }
    const s = mr._buildStroke(start, current);
    if (!s) { previewRef.visible(false); return; }
    // Preview shape type can change mid-stroke (unlikely, but keep it simple
    // - swap the preview node if the ctor differs).
    const desiredCtor = shapeCtor(s.type);
    if (previewRef.constructor !== desiredCtor) {
      previewRef.destroy();
      const next = makeShape(s);
      next.name('preview');
      next.visible(true);
      layer.add(next);
      previewRef = next;
      return;
    }
    applyStroke(previewRef, s);
    previewRef.visible(true);
  }

  function getPreview() { return previewRef; }

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
    drawingsSignal.value;
    activeMapIdSignal.value;
    mapsSignal.value;
    sync();
  });

  return { layer, shapes, dispose, sync, getPreview };
}

function shapeCtor(type) {
  if (type === 'rect') return Konva.Rect;
  if (type === 'circle') return Konva.Circle;
  return Konva.Line;
}
