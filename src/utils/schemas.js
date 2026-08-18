/**
 * Event Schema Validation - Entry Point
 *
 * Dispatches Matrix state events to type-specific validators and provides
 * deep-equality comparison for change detection.
 *
 * Validators are split across:
 *   - ./schemas/world.js    (settings, map, fog)
 *   - ./schemas/actors.js   (token, character, initiative)
 *   - ./schemas/content.js  (item, spell, drawing, handout, table, stroke)
 */

import { ErrorType, VTTError } from './errorHandling.js';
import { EVENT_TYPES } from './constants.js';
import { validateSettings, validateMap, validateFog, validateUiMode } from './schemas/world.js';
import { validateToken, validateCharacter, validateInitiative } from './schemas/actors.js';
import {
  validateItem,
  validateSpell,
  validateStroke,
  validateDrawing,
  validateHandout,
  validateTable,
  validateTemplate,
  validateWall,
  validateLight,
  validatePin,
} from './schemas/content.js';

export {
  validateSettings,
  validateMap,
  validateFog,
  validateToken,
  validateCharacter,
  validateInitiative,
  validateItem,
  validateSpell,
  validateStroke,
};

const VALIDATORS = {
  [EVENT_TYPES.SETTINGS]: validateSettings,
  [EVENT_TYPES.MAP]: validateMap,
  [EVENT_TYPES.FOG]: validateFog,
  [EVENT_TYPES.TOKEN]: validateToken,
  [EVENT_TYPES.INITIATIVE]: validateInitiative,
  [EVENT_TYPES.ITEM]: validateItem,
  [EVENT_TYPES.SPELL]: validateSpell,
  [EVENT_TYPES.DRAWING]: validateDrawing,
  [EVENT_TYPES.HANDOUT]: validateHandout,
  [EVENT_TYPES.TABLE]: validateTable,
  [EVENT_TYPES.TEMPLATE]: validateTemplate,
  [EVENT_TYPES.WALL]: validateWall,
  [EVENT_TYPES.LIGHT]: validateLight,
  [EVENT_TYPES.PIN]: validatePin,
  [EVENT_TYPES.UI_MODE]: validateUiMode,
};

export function validateStateEvent(type, content, systemConfig = null) {
  if (content && typeof content === 'object' && Object.keys(content).length === 0) return true;
  try {
    if (type === EVENT_TYPES.CHARACTER || type === EVENT_TYPES.NPC) {
      return validateCharacter(content, systemConfig);
    }
    const validator = VALIDATORS[type];
    if (validator) return validator(content);
    return true;
  } catch (error) {
    if (error instanceof VTTError) throw error;
    throw new VTTError(ErrorType.VALIDATION, `Validation error: ${error.message}`, error);
  }
}

export function stateEventsEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!stateEventsEqual(a[key], b[key])) return false;
  }
  return true;
}
