/**
 * src/map/layers/lights.js - Konva lights layer.
 *
 * Renders each light source as a Konva.Circle filled with a radial
 * gradient - bright at the centre, transparent at the radius. Visible
 * to GM and players alike. The vision-mask layer (`fog.js`) reads the
 * same `lightsSignal` to count lit cells as bright.
 */

import { effect } from '@preact/signals';
import Konva from 'konva';
import { lightsSignal, activeMapIdSignal, mapsSignal } from '../../state/signals.js';

const DEFAULT_COLOR = '#ffe8a8';
const DEFAULT_INTENSITY = 0.6;

function parseColor(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_COLOR;
  // UVTT colors are RGBA hex like 'ffaa00ff'. Konva understands '#rrggbb',
  // and we drive alpha via the gradient stops, so strip alpha if present.
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (hex.length >= 6) return `#${hex.slice(0, 6)}`;
  return DEFAULT_COLOR;
}

export function createLightsLayer(stage, _mr) {
  const layer = new Konva.Layer({ listening: false });
  layer.opacity(0.55);
  stage.add(layer);

  const circles = new Map();

  function sync() {
    const lights = lightsSignal.value;
    const activeId = activeMapIdSignal.value;
    // Look the active map up via mapsSignal (matches grid / map-bg /
    // env-tint pattern). Reading `mr.state.map` would skip the
    // signal-subscribe and miss the map-hydrated re-render.
    const map = activeId ? mapsSignal.value.get(activeId) : null;
    if (map && typeof map.width_cells === 'number' && typeof map.height_cells === 'number'
        && typeof map.cell_px === 'number') {
      const w = map.width_cells * map.cell_px;
      const h = map.height_cells * map.cell_px;
      // Konva.Layer + clipFunc applies `ctx.clip()` against the layer's
      // local canvas transform, which honours stage pan/zoom correctly.
      // The clipX/Y/Width/Height setters store the values but on Layer
      // (with scaled stage) don't visibly mask the render - see
      // demo light bleed past map edge before the clipFunc switch.
      layer.clipFunc((ctx) => { ctx.rect(0, 0, w, h); });
    } else {
      // Konva treats null clipFunc as "no clip applied" - safer than
      // passing zero-sized dimensions.
      layer.clipFunc(null);
    }
    const keep = new Set();
    if (lights) {
      for (const [id, l] of lights) {
        if (!l || typeof l.x !== 'number' || typeof l.y !== 'number') continue;
        if (typeof l.radius_px !== 'number' || l.radius_px <= 0) continue;
        if (l.map_id !== activeId) continue;
        keep.add(id);
        let circle = circles.get(id);
        if (!circle) {
          circle = new Konva.Circle({ name: 'light', listening: false });
          circles.set(id, circle);
          layer.add(circle);
        }
        const color = parseColor(l.color);
        const intensity = typeof l.intensity === 'number' ? l.intensity : DEFAULT_INTENSITY;
        circle.x(l.x);
        circle.y(l.y);
        circle.radius(l.radius_px);
        circle.fillRadialGradientStartPoint({ x: 0, y: 0 });
        circle.fillRadialGradientStartRadius(0);
        circle.fillRadialGradientEndPoint({ x: 0, y: 0 });
        circle.fillRadialGradientEndRadius(l.radius_px);
        circle.fillRadialGradientColorStops([0, color, 1, 'rgba(0,0,0,0)']);
        circle.opacity(Math.max(0, Math.min(1, intensity)));
      }
    }
    for (const [id, c] of circles) {
      if (!keep.has(id)) {
        c.destroy();
        circles.delete(id);
      }
    }
    layer.batchDraw();
  }

  const dispose = effect(() => {
    lightsSignal.value;
    activeMapIdSignal.value;
    // Subscribe to mapsSignal so the clip rect updates when the map
    // hydrates (post-snapshot) or when the active map's dimensions
    // change. Without this, the first sync ran with `map === null`
    // and the clip was never set after the data arrived.
    mapsSignal.value;
    sync();
  });

  return { layer, circles, dispose, sync };
}
