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
import { UI_MODE_VALUES } from '../constants.js';

const FOG_MODE_VALUES = Object.values(FOG_MODES);

const uiModeEventSchema = v.object({
  mode: v.picklist(UI_MODE_VALUES),
});

export function validateUiMode(content) {
  failIfNotObject(content, 'UI mode');
  return parseOrThrow(uiModeEventSchema, content,
    (issue) => `UI mode ${pathOf(issue)}: ${issue.message}`);
}

const settingsSchema = v.object({
  gm_user_ids: v.array(matrixUserId),
});

const mapSchema = v.object({
  width_cells: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
  height_cells: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
  cell_px: v.pipe(v.number(), v.minValue(10), v.maxValue(100)),
  image_url: v.optional(v.nullable(v.string())),
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
    return null;
  });
}

export function validateFog(content) {
  failIfNotObject(content, 'Fog');
  if (content.mode !== undefined && !FOG_MODE_VALUES.includes(content.mode)) {
    failValidation('Fog mode must be: visible, gm_only, or hidden');
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
