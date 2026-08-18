/**
 * src/map/layers/map-bg.js - Konva map-background layer.
 *
 * Renders the image-layer stack defined by the active map's
 * `layers[]`. When no layers are present, paints the fallback solid
 * floor colour. GM-only layers render at 0.2 alpha so the GM can see
 * what's hidden from players.
 */
import { effect } from '@preact/signals';
import Konva from 'konva';
import { activeMapIdSignal, mapsSignal } from '../../state/signals.js';
import { getOrLoadImage } from './image-cache.js';

export function createMapBgLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  // Signature cache: skip the destroyChildren + new Konva.Image
  // chain when the inputs haven't changed. Without this, every
  // mr.render() during pan / drag re-decoded the background image -
  // a real GC + allocation hot path identified in the production
  // audit's drag-perf cluster.
  let lastSig = '';

  function sync() {
    const map = activeMap();
    const isGM = !!mr.state?.isGM?.();
    const themeFloor = mr._colors?.mapFloor || '#1a2035';

    const sig = !map
      ? 'no-map'
      : JSON.stringify({
          w: map.width_cells, h: map.height_cells, px: map.cell_px,
          layers: map.layers ?? (map.image_url ? [{ id: 'base', image_url: map.image_url, visible: true, opacity: 1 }] : []),
          gm: isGM, fl: themeFloor,
        });
    if (sig === lastSig) return;
    lastSig = sig;

    layer.destroyChildren();
    if (!map) { layer.batchDraw(); return; }

    const layers = Array.isArray(map.layers)
      ? map.layers
      : map.image_url
        ? [{ id: 'base', image_url: map.image_url, visible: true, opacity: 1 }]
        : [];

    const w = map.width_cells * map.cell_px;
    const h = map.height_cells * map.cell_px;

    if (layers.length === 0) {
      layer.add(new Konva.Rect({
        x: 0, y: 0, width: w, height: h,
        fill: themeFloor,
        listening: false,
      }));
      layer.batchDraw();
      return;
    }

    for (const l of layers) {
      if (!l.visible || (l.gm_only && !isGM)) continue;
      const img = getOrLoadImage(mr, l.image_url, l.id);
      layer.add(new Konva.Image({
        image: img || undefined,
        x: 0, y: 0, width: w, height: h,
        opacity: l.gm_only ? 0.2 : (l.opacity ?? 1),
        listening: false,
      }));
    }
    layer.batchDraw();
  }

  function activeMap() {
    const id = activeMapIdSignal.value;
    if (!id) return null;
    return mapsSignal.value.get(id) || null;
  }

  sync();
  const dispose = effect(() => {
    activeMapIdSignal.value;
    mapsSignal.value;
    sync();
  });

  return { layer, dispose, sync };
}
