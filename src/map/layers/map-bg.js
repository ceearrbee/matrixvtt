/**
 * src/map/layers/map-bg.js - Konva map-background layer.
 *
 * Paints the fill resolved by `resolveBackgroundSource` (theme floor, or
 * a repeating terrain tile) and then the map's image-layer stack on top.
 * GM-only layers render at 0.2 alpha so the GM can see what's hidden
 * from players.
 */
import { effect } from '@preact/signals';
import Konva from 'konva';
import { activeMapIdSignal, mapsSignal } from '../../state/signals.js';
import { resolveBackgroundSource } from '../background-source.js';
import { builtinTileUrl } from '../../utils/builtin-backgrounds.js';
import { generatedSignature, getGeneratedCanvas } from '../generators/cache.js';
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
    const { fill, layers } = resolveBackgroundSource(map);

    const sig = !map
      ? 'no-map'
      : JSON.stringify({
          w: map.width_cells, h: map.height_cells, px: map.cell_px,
          fill, layers, gm: isGM, fl: themeFloor, gen: generatedSignature(map),
        });
    if (sig === lastSig) return;
    lastSig = sig;

    layer.destroyChildren();
    if (!map) { layer.batchDraw(); return; }

    const w = map.width_cells * map.cell_px;
    const h = map.height_cells * map.cell_px;

    if (fill.kind === 'tile') {
      layer.add(tileRect(mr, fill, w, h, themeFloor, invalidate));
    } else if (fill.kind === 'generated') {
      const canvas = getGeneratedCanvas(mr, map, invalidate);
      if (canvas) {
        layer.add(new Konva.Image({
          name: 'generated-bg', image: canvas,
          x: 0, y: 0, width: w, height: h, listening: false,
        }));
      } else {
        layer.add(floorRect(w, h, themeFloor));
      }
    } else if (fill.kind === 'floor') {
      layer.add(floorRect(w, h, themeFloor));
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

  // Konva caches the CanvasPattern the first time it draws a Rect, so one
  // built while the tile was still decoding would stay blank for good.
  // Drop the signature and rebuild once the image lands.
  function invalidate() {
    lastSig = '';
    sync();
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

function floorRect(w, h, themeFloor) {
  return new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: themeFloor, listening: false });
}

function tileRect(mr, fill, w, h, themeFloor, onDecoded) {
  const img = getOrLoadImage(mr, builtinTileUrl(fill.tile), `tile-${fill.tile}`);
  const ready = !!img && img.complete && img.naturalWidth > 0;
  if (img && !ready) img.addEventListener('load', onDecoded, { once: true });
  return new Konva.Rect({
    x: 0, y: 0, width: w, height: h,
    fill: ready ? undefined : themeFloor,
    fillPatternImage: ready ? img : undefined,
    fillPatternRepeat: 'repeat',
    fillPatternScale: { x: fill.scale, y: fill.scale },
    listening: false,
  });
}
