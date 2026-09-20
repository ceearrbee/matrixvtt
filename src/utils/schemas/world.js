/**
 * Schemas for settings, map, and fog state events.
 */

import {
  v,
  matrixUserId,
  cellCoord,
  failIfNotObject,
  failValidation,
  parseOrThrow,
  pathOf,
} from './helpers.js';
import { FOG_MODES } from '../ui-constants.js';

const FOG_MODE_VALUES = Object.values(FOG_MODES);

const settingsSchema = v.object({
  gm_user_ids: v.array(matrixUserId),
});

/**
 * The one place a map's dimensions are bounded. The map form imports
 * this too, so the form and the room-state schema cannot drift.
 */
export const MAP_BOUNDS = Object.freeze({
  cells: Object.freeze({ min: 1, max: 100 }),
  cellPx: Object.freeze({ min: 10, max: 100 }),
});

/**
 * A map can carry a `background` descriptor instead of an image: a few
 * bytes of room state the renderer paints from, so a table gets a real
 * background with nothing uploaded.
 *
 * Deliberately permissive about `kind`. A peer on a newer build can
 * write one this build has never heard of, and dropping the whole map
 * over it is worse than painting the theme floor, which is what
 * `resolveBackgroundSource` does with an unknown kind.
 */
const nonEmpty = (value) => typeof value === 'string' && value !== '';

const backgroundSchema = v.pipe(
  v.looseObject({ kind: v.string() }),
  v.check((bg) => bg.kind !== 'tile' || nonEmpty(bg.tile)),
  v.check((bg) => bg.kind !== 'generated' || (nonEmpty(bg.generator) && nonEmpty(bg.seed))),
);

const mapSchema = v.object({
  width_cells: v.pipe(v.number(), v.minValue(MAP_BOUNDS.cells.min), v.maxValue(MAP_BOUNDS.cells.max)),
  height_cells: v.pipe(v.number(), v.minValue(MAP_BOUNDS.cells.min), v.maxValue(MAP_BOUNDS.cells.max)),
  cell_px: v.pipe(v.number(), v.minValue(MAP_BOUNDS.cellPx.min), v.maxValue(MAP_BOUNDS.cellPx.max)),
  image_url: v.optional(v.nullable(v.string())),
  background: v.optional(v.nullable(backgroundSchema)),
});

const fogSchema = v.object({
  mode: v.picklist(FOG_MODE_VALUES),
  revealed: v.array(cellCoord),
});

export function validateSettings(content) {
  failIfNotObject(content, 'Settings');
  return parseOrThrow(settingsSchema, content, (issue) => {
    const path = pathOf(issue);
    if (path === 'gm_user_ids' || !path) return 'Settings must include gm_user_ids array';
    if (path.startsWith('gm_user_ids')) return `Invalid user ID format: ${issue.input}`;
    return null;
  });
}

export function validateMap(content) {
  failIfNotObject(content, 'Map');
  if (Object.keys(content).length === 0) return true;
  return parseOrThrow(mapSchema, content, (issue) => {
    const path = pathOf(issue);
    if (path === 'width_cells') return 'Map width_cells must be between 1 and 100';
    if (path === 'height_cells') return 'Map height_cells must be between 1 and 100';
    if (path === 'cell_px') return 'Cell size must be between 10 and 100';
    if (path === 'image_url') return 'Map image_url must be a string';
    if (path.startsWith('background')) {
      return 'Map background must be an object with a kind; a tile background names a tile, a generated one names a generator and a seed';
    }
    return null;
  });
}

export function validateFog(content) {
  failIfNotObject(content, 'Fog');
  if (content.mode !== undefined && !FOG_MODE_VALUES.includes(content.mode)) {
    failValidation('Fog mode must be: visible or hidden');
  }
  // Tolerate missing / null `revealed` - older schema versions and
  // hand-authored imports sometimes omit it. Coerce to an empty array
  // before schema parsing so an otherwise-valid fog event isn't dropped
  // (which would leave fog stuck in the previous state on all clients).
  const normalised = Array.isArray(content.revealed)
    ? content
    : { ...content, revealed: [] };
  return parseOrThrow(fogSchema, normalised, (issue) => {
    if (pathOf(issue).startsWith('revealed')) {
      return `Invalid cell coordinate: ${JSON.stringify(issue.input)} (type: ${typeof issue.input})`;
    }
    return null;
  });
}
