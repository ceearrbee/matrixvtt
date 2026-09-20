/**
 * src/map/background-source.js - what paints under a map's image layers.
 *
 * A map can carry a `background` descriptor instead of an uploaded
 * image. The descriptor is a handful of bytes in room state, so a table
 * gets a real background without anyone uploading a battlemap.
 *
 * Pure: the Konva layer and the map form both resolve through here.
 */

import { SEED_PATTERN } from './generators/rng.js';
import { DEFAULT_PALETTE } from './generators/palettes.js';

const MAX_TILE_SCALE = 8;
const STYLES = ['textured', 'lines'];
const DEFAULT_STYLE = 'textured';

/**
 * @param {object|null} map
 * @returns {{ fill: object, layers: Array<object> }}
 *   `fill` is `{kind:'floor'}` (theme colour), `{kind:'none'}` (a legacy
 *   image covers the whole map), or `{kind:'tile', tile, scale}`.
 *   `layers` are the image layers drawn on top, bottom-first.
 */
export function resolveBackgroundSource(map) {
  const layers = imageLayers(map);
  const background = map?.background;
  const fill = tileFill(background) ?? generatedFill(background);
  if (fill) return { fill, layers };
  return { fill: layers.length ? { kind: 'none' } : { kind: 'floor' }, layers };
}

function tileFill(background) {
  if (!background || typeof background !== 'object') return null;
  if (background.kind !== 'tile') return null;
  if (typeof background.tile !== 'string' || background.tile === '') return null;
  return { kind: 'tile', tile: background.tile, scale: tileScale(background.scale) };
}

function generatedFill(background) {
  if (!background || typeof background !== 'object') return null;
  if (background.kind !== 'generated') return null;
  if (typeof background.generator !== 'string' || background.generator === '') return null;
  if (typeof background.seed !== 'string' || !SEED_PATTERN.test(background.seed)) return null;
  return {
    kind: 'generated',
    generator: background.generator,
    seed: background.seed,
    palette: typeof background.palette === 'string' ? background.palette : DEFAULT_PALETTE,
    style: STYLES.includes(background.style) ? background.style : DEFAULT_STYLE,
    params: background.params && typeof background.params === 'object' ? background.params : null,
  };
}

function tileScale(scale) {
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(scale, MAX_TILE_SCALE);
}

function imageLayers(map) {
  if (Array.isArray(map?.layers)) return map.layers.filter((l) => l?.image_url);
  if (map?.image_url) return [{ id: 'base', image_url: map.image_url, visible: true, opacity: 1 }];
  return [];
}

/**
 * Coerce an untrusted background value (a hidden form field, a pasted
 * import) into one the renderer can actually paint, or null. Runs the
 * same resolution the Konva layer does, so the form cannot save a
 * descriptor that would silently fall back to the theme floor.
 */
export function normaliseBackground(value) {
  const { fill } = resolveBackgroundSource({ background: value });
  return fill.kind === 'floor' ? null : fill;
}

/** Short human summary of a descriptor, for the map form's read-only row. */
export function describeBackground(descriptor) {
  const fill = normaliseBackground(descriptor);
  if (!fill) return 'None';
  if (fill.kind === 'tile') return `Tile: ${fill.tile}`;
  if (fill.kind === 'generated') return `${fill.generator} - seed ${fill.seed} - ${fill.palette}`;
  return fill.kind;
}
