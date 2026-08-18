/**
 * Schemas for items, spells, drawings, handouts, and tables.
 */

import { hexColor, failIfNotObject, failValidation, parseOrThrow, validateImageUrlField } from './helpers.js';

export function validateItem(content) {
  failIfNotObject(content, 'Item');
  if (typeof content.name !== 'string' || !content.name) {
    failValidation('Item must have a name string');
  }
  if (content.quantity !== undefined && (typeof content.quantity !== 'number' || content.quantity < 0)) {
    failValidation('Item quantity must be a non-negative number');
  }
  // `null` should be tolerated alongside `undefined` - older schema
  // versions and hand-authored imports often store a cleared toggle as
  // `null`. Treating it as invalid silently drops otherwise-usable items
  // and leaves ghost entities on the server.
  if (content.equipped !== undefined && content.equipped !== null
      && typeof content.equipped !== 'boolean') {
    failValidation('Item equipped must be boolean');
  }
  validateImageUrlField(content, 'Item');
  return true;
}

export function validateSpell(content) {
  failIfNotObject(content, 'Spell');
  if (typeof content.name !== 'string' || !content.name) {
    failValidation('Spell must have a name string');
  }
  if (
    typeof content.level !== 'number' ||
    !Number.isInteger(content.level) ||
    content.level < 0 ||
    content.level > 9
  ) {
    failValidation('Spell level must be an integer 0–9');
  }
  if (content.prepared !== undefined && typeof content.prepared !== 'boolean') {
    failValidation('Spell prepared must be boolean');
  }
  validateImageUrlField(content, 'Spell');
  return true;
}

export function validateStroke(stroke) {
  failIfNotObject(stroke, 'Stroke');
  if (!stroke.id) failValidation('Stroke must have an id');
  if (typeof stroke.map_id !== 'string' || !stroke.map_id) {
    failValidation('Stroke must have map_id string');
  }
  if (!['pencil', 'line', 'rect', 'circle', 'cone'].includes(stroke.type)) {
    failValidation(`Invalid stroke type: ${stroke.type}`);
  }
  if (stroke.type === 'pencil' && (!Array.isArray(stroke.points) || stroke.points.length === 0)) {
    failValidation('Pencil stroke must have a non-empty points array');
  }
  if (stroke.color !== undefined) {
    parseOrThrow(hexColor, stroke.color, () => 'Invalid color format (must be #hex)');
  }
  return true;
}

export function validateDrawing(content) {
  failIfNotObject(content, 'Drawing');
  if (content.strokes) {
    if (!Array.isArray(content.strokes)) failValidation('strokes must be an array');
    content.strokes.forEach(validateStroke);
  } else if (content.id && content.type) {
    validateStroke(content);
  } else if (Object.keys(content).length > 0) {
    failValidation('Drawing content must be a tombstone, a stroke object, or a legacy {strokes} array');
  }
  return true;
}

const TEMPLATE_SHAPES = ['circle', 'cone', 'line', 'square'];

export function validateTemplate(content) {
  failIfNotObject(content, 'Template');
  if (typeof content.id !== 'string' || !content.id) failValidation('Template must have id');
  if (typeof content.map_id !== 'string' || !content.map_id) {
    failValidation('Template must have map_id string');
  }
  if (!TEMPLATE_SHAPES.includes(content.shape)) {
    failValidation(`Invalid template shape: ${content.shape}`);
  }
  if (!content.origin || typeof content.origin.col !== 'number' || typeof content.origin.row !== 'number') {
    failValidation('Template must have origin {col, row}');
  }
  if (content.color !== undefined) {
    parseOrThrow(hexColor, content.color, () => 'Invalid color format (must be #hex)');
  }
  for (const k of ['radius', 'length', 'width', 'rotation']) {
    if (content[k] !== undefined && typeof content[k] !== 'number') {
      failValidation(`Template ${k} must be a number`);
    }
  }
  return true;
}

export function validateWall(content) {
  failIfNotObject(content, 'Wall');
  if (typeof content.id !== 'string' || !content.id) failValidation('Wall must have id');
  if (typeof content.map_id !== 'string' || !content.map_id) {
    failValidation('Wall must have map_id string');
  }
  const p1 = content.p1, p2 = content.p2;
  if (!p1 || typeof p1.x !== 'number' || typeof p1.y !== 'number') {
    failValidation('Wall must have p1 {x, y}');
  }
  if (!p2 || typeof p2.x !== 'number' || typeof p2.y !== 'number') {
    failValidation('Wall must have p2 {x, y}');
  }
  for (const k of ['blocks_sight', 'blocks_movement', 'is_portal', 'is_open']) {
    if (content[k] !== undefined && typeof content[k] !== 'boolean') {
      failValidation(`Wall ${k} must be boolean`);
    }
  }
  return true;
}

export function validateLight(content) {
  failIfNotObject(content, 'Light');
  if (typeof content.id !== 'string' || !content.id) failValidation('Light must have id');
  if (typeof content.map_id !== 'string' || !content.map_id) {
    failValidation('Light must have map_id string');
  }
  if (typeof content.x !== 'number' || !Number.isFinite(content.x)) {
    failValidation('Light must have numeric x');
  }
  if (typeof content.y !== 'number' || !Number.isFinite(content.y)) {
    failValidation('Light must have numeric y');
  }
  if (typeof content.radius_px !== 'number' || content.radius_px < 0) {
    failValidation('Light must have non-negative numeric radius_px');
  }
  if (content.intensity !== undefined && typeof content.intensity !== 'number') {
    failValidation('Light intensity must be a number');
  }
  if (content.color !== undefined && content.color !== null && content.color !== '') {
    if (typeof content.color !== 'string') failValidation('Light color must be a string');
  }
  return true;
}

export function validatePin(content) {
  failIfNotObject(content, 'Pin');
  if (typeof content.id !== 'string' || !content.id) failValidation('Pin must have id');
  if (typeof content.map_id !== 'string' || !content.map_id) {
    failValidation('Pin must have map_id string');
  }
  if (typeof content.col !== 'number' || !Number.isFinite(content.col)) {
    failValidation('Pin must have numeric col');
  }
  if (typeof content.row !== 'number' || !Number.isFinite(content.row)) {
    failValidation('Pin must have numeric row');
  }
  if (typeof content.label !== 'string') failValidation('Pin must have label string');
  if (content.color !== undefined && content.color !== null && content.color !== '') {
    parseOrThrow(hexColor, content.color, () => 'Invalid pin color (must be #hex)');
  }
  if (content.gm_only !== undefined && typeof content.gm_only !== 'boolean') {
    failValidation('Pin gm_only must be boolean');
  }
  return true;
}

export function validateHandout(content) {
  failIfNotObject(content, 'Handout');
  if (typeof content.title !== 'string' || !content.title) {
    failValidation('Handout must have title string');
  }
  validateImageUrlField(content, 'Handout');
  return true;
}

export function validateTable(content) {
  failIfNotObject(content, 'Table');
  if (typeof content.name !== 'string' || !content.name) {
    failValidation('Table must have name string');
  }
  if (!Array.isArray(content.entries)) {
    failValidation('Table must have entries array');
  }
  return true;
}
