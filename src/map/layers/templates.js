/**
 * src/map/layers/templates.js - Konva templates layer.
 *
 * Persistent AoE templates (circle /
 * square / cone / line) placed by the GM. Each template becomes a
 * Konva.Group containing its shape + optional label; the group is
 * diffed against `templatesSignal`.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { templatesSignal, activeMapIdSignal } from '../../state/signals.js';
import { TOKEN_COLORS } from '../../utils/ui-constants.js';

export function createTemplatesLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  const groups = new Map();
  // Cache the JSON signature of each template's last-rendered shape;
  // skip the destroyChildren + makeShape rebuild when the template
  // hasn't changed between renders. Mr.render() fires on every pan /
  // drag tick, so calling update() unconditionally was reallocating
  // every template's children many times per second.
  const lastSig = new Map();

  function build(t) {
    const group = new Konva.Group({ listening: false });
    group.add(makeShape(t));
    if (t.label) group.add(makeLabel(t));
    return group;
  }

  function update(group, t) {
    // Shape type may have changed on edit; rebuild children in place.
    group.destroyChildren();
    group.add(makeShape(t));
    if (t.label) group.add(makeLabel(t));
  }

  function makeShape(t) {
    const cellPx = mr.state?.map?.cell_px ?? 40;
    const ox = (t.origin?.col ?? 0) * cellPx;
    const oy = (t.origin?.row ?? 0) * cellPx;
    const color = t.color || TOKEN_COLORS.AREA_HIDE;
    const fill = color + '33';
    const zoom = mr.zoom || 1;
    const strokeWidth = 2 / zoom;

    if (t.shape === 'circle') {
      const r = (t.radius || 1) * cellPx;
      return new Konva.Circle({ x: ox, y: oy, radius: r, fill, stroke: color, strokeWidth, listening: false });
    }
    if (t.shape === 'square') {
      const r = (t.radius || 1) * cellPx;
      return new Konva.Rect({ x: ox - r, y: oy - r, width: r * 2, height: r * 2, fill, stroke: color, strokeWidth, listening: false });
    }
    if (t.shape === 'cone') {
      const len = (t.length || 3) * cellPx;
      const rot = ((t.rotation || 0) * Math.PI) / 180;
      const half = Math.PI / 4;
      const points = [
        ox, oy,
        ox + Math.cos(rot - half) * len, oy + Math.sin(rot - half) * len,
        ox + Math.cos(rot + half) * len, oy + Math.sin(rot + half) * len,
      ];
      return new Konva.Line({ points, fill, stroke: color, strokeWidth, closed: true, listening: false });
    }
    if (t.shape === 'line') {
      const len = (t.length || 3) * cellPx;
      const w = (t.width || 0.5) * cellPx;
      return new Konva.Rect({
        x: ox, y: oy, width: len, height: w,
        offsetY: w / 2, rotation: t.rotation || 0,
        fill, stroke: color, strokeWidth, listening: false,
      });
    }
    // Unknown shape - harmless empty placeholder.
    return new Konva.Group({ listening: false });
  }

  function makeLabel(t) {
    const cellPx = mr.state?.map?.cell_px ?? 40;
    const ox = (t.origin?.col ?? 0) * cellPx;
    const oy = (t.origin?.row ?? 0) * cellPx;
    const zoom = mr.zoom || 1;
    return new Konva.Text({
      x: ox - 50, y: oy - 6 / zoom - 12 / zoom,
      width: 100, align: 'center',
      text: t.label, fill: mr._colors?.textInverse || '#ffffff',
      fontSize: 12 / zoom, fontFamily: 'sans-serif',
      listening: false,
    });
  }

  function sync() {
    const templates = templatesSignal.value;
    const activeId = activeMapIdSignal.value;
    const keep = new Set();
    const cellPx = mr.state?.map?.cell_px ?? 40;
    const zoom = mr.zoom || 1;
    if (templates) {
      for (const [id, t] of templates) {
        if (!t) continue;
        if (t.map_id !== activeId) continue;
        keep.add(id);
        // Signature includes the rendering inputs that aren't part
        // of `t` (cellPx + zoom): a zoom change means strokes need
        // re-draw. Without those, a zoom while a template existed
        // would leave the shape at the old line width.
        const sig = `${cellPx}|${zoom}|${JSON.stringify(t)}`;
        let group = groups.get(id);
        if (!group) {
          group = build(t);
          groups.set(id, group);
          layer.add(group);
          lastSig.set(id, sig);
        } else if (lastSig.get(id) !== sig) {
          update(group, t);
          lastSig.set(id, sig);
        }
      }
    }
    for (const [id, group] of groups) {
      if (!keep.has(id)) {
        group.destroy();
        groups.delete(id);
        lastSig.delete(id);
      }
    }
    layer.batchDraw();
  }

  const dispose = effect(() => {
    templatesSignal.value;
    activeMapIdSignal.value;
    sync();
  });

  return { layer, groups, dispose, sync };
}
