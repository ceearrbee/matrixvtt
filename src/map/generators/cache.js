/**
 * Memoised canvases for generated map backgrounds.
 *
 * The map stores a seed; this turns that seed into pixels once and
 * hands the same canvas back until something that changes the picture
 * changes. Without the memo, every pan frame would regenerate the
 * terrain and repaint a 2000px canvas.
 */

import { builtinTileUrl } from '../../utils/builtin-backgrounds.js';
import { getOrLoadImage } from '../layers/image-cache.js';
import { generateTerrain } from './index.js';
import { resolvePalette } from './palettes.js';
import { paintTerrain, terrainCanvasSize } from './paint.js';

export const GENERATED_CACHE_MAX = 4;

const cache = new Map();

/**
 * Stable key for a map's generated background, or '' if it has none.
 *
 * Theme colours are deliberately absent: a generated map is painted
 * from its own material palette, not the app theme, so switching theme
 * must not throw the canvas away.
 */
export function generatedSignature(map) {
  const bg = map?.background;
  if (!bg || bg.kind !== 'generated') return '';
  return JSON.stringify([
    bg.generator, bg.seed, bg.palette, bg.style, sortedParams(bg.params),
    map.width_cells, map.height_cells, map.cell_px,
  ]);
}

/**
 * Canvas for the map's generated background, or null when it has none
 * or the descriptor is unusable. `onTileDecoded` fires once when a
 * palette tile that was still loading lands, so the caller can drop its
 * own signature and repaint with the texture.
 *
 * `host` is anything carrying a `_tokenImages` cache: the map renderer
 * at the table, or the picker's preview host.
 */
export function getGeneratedCanvas(host, map, onTileDecoded) {
  const key = generatedSignature(map);
  if (!key) return null;

  const bg = map.background;
  const palette = resolvePalette(bg.palette);
  const lines = bg.style === 'lines';
  const tileImages = lines ? new Map() : loadPaletteTiles(host, palette, onTileDecoded);

  const full = `${key}|${[...tileImages.keys()].sort().join(',')}`;
  const hit = cache.get(full);
  if (hit) {
    cache.delete(full);
    cache.set(full, hit);
    return hit;
  }

  const grid = generateTerrain({
    generator: bg.generator,
    seed: bg.seed,
    width: map.width_cells,
    height: map.height_cells,
    params: bg.params,
  });
  if (!grid) return null;

  const { width, height, scale } = terrainCanvasSize(map.width_cells, map.height_cells, map.cell_px);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  paintTerrain(ctx, grid, { cellPx: map.cell_px, style: bg.style, palette, tileImages });

  cache.set(full, canvas);
  if (cache.size > GENERATED_CACHE_MAX) cache.delete(cache.keys().next().value);
  return canvas;
}

/** Only the tiles this palette actually names, and only the decoded ones. */
function loadPaletteTiles(host, palette, onTileDecoded) {
  const loaded = new Map();
  for (const tileId of Object.values(palette.tiles)) {
    const img = getOrLoadImage(host, builtinTileUrl(tileId), `tile-${tileId}`);
    if (!img) continue;
    if (img.complete && img.naturalWidth > 0) loaded.set(tileId, img);
    else if (onTileDecoded) img.addEventListener('load', onTileDecoded, { once: true });
  }
  return loaded;
}

function sortedParams(params) {
  if (!params || typeof params !== 'object') return null;
  return Object.keys(params).sort().map((k) => [k, params[k]]);
}

// Test-only reset
export function _resetGeneratedCache() {
  cache.clear();
}
