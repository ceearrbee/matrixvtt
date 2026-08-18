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
import { drawingsSignal, activeMapIdSignal } from '../../state/signals.js';

export function createDrawingsLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const shapes = new Map();

  let previewRef = makeShape({ type: 'pencil', color: '#fff', width: 1, points: [] });
  previewRef.name('preview');
  previewRef.visible(false);
  layer.add(previewRef);

  function applyStroke(shape, s) {
    shape.stroke(s.color);
    shape.strokeWidth(s.width);
    shape.lineCap('round');
    shape.lineJoin('round');
    if (s.type === 'pencil' || s.type === 'line') {
      const pts = [];
      for (const p of s.points) { pts.push(p.x, p.y); }
      shape.points(pts);
      shape.closed(false);
    } else if (s.type === 'rect') {
      shape.position({ x: s.x, y: s.y });
      shape.size({ width: s.w, height: s.h });
      shape.fillEnabled(false);
    } else if (s.type === 'circle') {
      shape.position({ x: s.x, y: s.y });
      shape.radius(s.r);
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
    syncCommitted();
    syncPreview();
    layer.batchDraw();
  }

  const dispose = effect(() => {
    drawingsSignal.value;
    activeMapIdSignal.value;
    syncCommitted();
    layer.batchDraw();
  });

  return { layer, shapes, dispose, sync, getPreview };
}

function shapeCtor(type) {
  if (type === 'rect') return Konva.Rect;
  if (type === 'circle') return Konva.Circle;
  return Konva.Line;
}
