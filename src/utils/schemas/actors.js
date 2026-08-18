/**
 * Schemas for tokens, characters, and initiative order.
 */

import { failIfNotObject, failValidation, validateImageUrlField } from './helpers.js';
import { ENTITY_TYPES } from '../constants.js';

export function validateToken(content) {
  failIfNotObject(content, 'Token');
  if (!content.id || typeof content.id !== 'string') {
    failValidation('Token must have id string');
  }
  if (typeof content.map_id !== 'string' || !content.map_id) {
    failValidation('Token must have map_id string');
  }
  if (content.sheet_id === undefined) {
    failValidation('Token must have sheet_id string');
  }
  if (content.sheet_id !== null && (typeof content.sheet_id !== 'string' || content.sheet_id.trim() === '')) {
    failValidation('Token must have sheet_id string');
  }
  if (typeof content.col !== 'number' || content.col < 0) {
    failValidation('Token col must be non-negative number');
  }
  if (typeof content.row !== 'number' || content.row < 0) {
    failValidation('Token row must be non-negative number');
  }
  if (content.size !== undefined && (typeof content.size !== 'number' || content.size < 1 || content.size > 4)) {
    failValidation('Token size must be 1-4');
  }
  if (content.visible !== undefined && typeof content.visible !== 'boolean') {
    failValidation('Token visible must be boolean');
  }
  if (content.conditions !== undefined && !Array.isArray(content.conditions)) {
    failValidation('Token conditions must be an array');
  }
  // Accept null as "no durations tracked" - older writes sometimes
  // cleared the field to null instead of removing it. Treating that as
  // an error drops the whole token event from sync, which was hiding
  // otherwise-healthy tokens.
  if (
    content.condition_durations !== undefined &&
    content.condition_durations !== null &&
    typeof content.condition_durations !== 'object'
  ) {
    failValidation('Token condition_durations must be an object');
  }
  for (const field of ['vision_radius', 'darkvision_radius']) {
    if (content[field] !== undefined && (typeof content[field] !== 'number' || content[field] < 0)) {
      failValidation(`Token ${field} must be a non-negative number`);
    }
  }
  if (content.variants !== undefined && content.variants !== null) {
    if (!Array.isArray(content.variants)) failValidation('Token variants must be an array');
    for (const v of content.variants) {
      if (!v || typeof v !== 'object') failValidation('Token variants entries must be objects');
      if (typeof v.label !== 'string' || !v.label) {
        failValidation('Token variant must have a non-empty label string');
      }
      if (typeof v.image_url !== 'string' || !v.image_url) {
        failValidation('Token variant must have a non-empty image_url string');
      }
    }
  }
  if (content.trackers !== undefined && content.trackers !== null) {
    if (!Array.isArray(content.trackers)) failValidation('Token trackers must be an array');
    for (const t of content.trackers) {
      if (!t || typeof t !== 'object') failValidation('Token trackers entries must be objects');
      if (typeof t.label !== 'string' || !t.label) {
        failValidation('Token tracker must have a non-empty label string');
      }
      if (typeof t.value !== 'number' || !Number.isFinite(t.value)) {
        failValidation('Token tracker must have a finite numeric value');
      }
      if (t.max !== undefined && (typeof t.max !== 'number' || !Number.isFinite(t.max))) {
        failValidation('Token tracker max must be a finite number');
      }
    }
  }
  validateImageUrlField(content, 'Token');
  if (content.auras !== undefined && content.auras !== null) {
    if (!Array.isArray(content.auras)) failValidation('Token auras must be an array');
    for (const a of content.auras) {
      if (!a || typeof a !== 'object') failValidation('Token auras entries must be objects');
      if (typeof a.radius !== 'number' || !Number.isFinite(a.radius) || a.radius < 0) {
        failValidation('Token auras entry must have a non-negative numeric radius');
      }
      if (a.color !== undefined && typeof a.color !== 'string') {
        failValidation('Token auras entry color must be a string');
      }
      if (a.opacity !== undefined && (typeof a.opacity !== 'number' || a.opacity < 0 || a.opacity > 1)) {
        failValidation('Token auras entry opacity must be 0..1');
      }
    }
  }
  return true;
}

export function validateCharacter(content, systemConfig = null) {
  failIfNotObject(content, 'Character');
  if (!content.id || typeof content.id !== 'string') {
    failValidation('Character must have id string');
  }
  if (!content.name || typeof content.name !== 'string') {
    failValidation('Character must have name string');
  }
  if (!content.type || ![ENTITY_TYPES.PC, ENTITY_TYPES.NPC].includes(content.type)) {
    failValidation(`Character type must be ${ENTITY_TYPES.PC} or ${ENTITY_TYPES.NPC}`);
  }
  validateCharacterAttributes(content, systemConfig);
  validateCharacterNumericStats(content);
  validateNarrativeFields(content);
  validateImageUrlField(content, 'Character');
  if (content.type === ENTITY_TYPES.NPC) validateNPCActionArrays(content);
  if (content.controlled_by != null && typeof content.controlled_by !== 'string') {
    failValidation('controlled_by must be a user-id string or null');
  }
  return true;
}

/**
 * Optional narrative-primitive field shapes. Any field may be absent;
 * if present, the shape must match what the generic section renderers
 * expect:
 *
 *   aspects          string[]
 *   stress           Record<string, boolean[]> (multi-track) OR boolean[] (legacy)
 *   consequences     Record<string, string>
 *   fate_points / fate_refresh / fate_max   finite numbers
 *
 * Permissive about unknown extra fields - rulesets can introduce new
 * ones without churning this schema. See spec §7.
 */
function validateNarrativeFields(content) {
  const { aspects, stress, consequences } = content;

  if (aspects !== undefined) {
    if (!Array.isArray(aspects)) failValidation('Character aspects must be an array of strings');
    for (const a of aspects) {
      if (typeof a !== 'string') failValidation('Character aspects entries must be strings');
    }
  }

  if (stress !== undefined && stress !== null) {
    const isArrayShape = Array.isArray(stress);
    const isObjectShape = typeof stress === 'object' && !isArrayShape;
    if (!isArrayShape && !isObjectShape) {
      failValidation('Character stress must be a boolean array (legacy) or object of named tracks');
    }
    if (isObjectShape) {
      for (const [name, arr] of Object.entries(stress)) {
        if (!Array.isArray(arr)) {
          failValidation(`Character stress.${name} must be a boolean array`);
        }
        for (const v of arr) {
          if (typeof v !== 'boolean') {
            failValidation(`Character stress.${name} entries must be booleans`);
          }
        }
      }
    } else {
      for (const v of stress) {
        if (typeof v !== 'boolean') failValidation('Character stress entries must be booleans');
      }
    }
  }

  if (consequences !== undefined && consequences !== null) {
    if (Array.isArray(consequences) || typeof consequences !== 'object') {
      failValidation('Character consequences must be an object of named slots');
    }
    for (const [key, val] of Object.entries(consequences)) {
      if (typeof val !== 'string') {
        failValidation(`Character consequences.${key} must be a string`);
      }
    }
  }

  for (const k of ['fate_points', 'fate_refresh', 'fate_max']) {
    const v = content[k];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      failValidation(`Character ${k} must be a finite number`);
    }
  }

  for (const k of ['alignment', 'background', 'ideals', 'bonds', 'flaws']) {
    if (content[k] !== undefined && typeof content[k] !== 'string') {
      failValidation(`Character ${k} must be a string`);
    }
  }

  // currency: Record<denom, number>. Each value must be a finite
  // non-negative number. Denominations themselves come from the
  // ruleset declaration - no enum check here, just shape.
  if (content.currency !== undefined && content.currency !== null) {
    if (typeof content.currency !== 'object' || Array.isArray(content.currency)) {
      failValidation('Character currency must be an object keyed by denomination');
    }
    for (const [denom, v] of Object.entries(content.currency)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        failValidation(`Character currency.${denom} must be a non-negative finite number`);
      }
    }
  }

  const pending = content.pending_modifiers;
  if (pending !== undefined && pending !== null) {
    if (!Array.isArray(pending)) failValidation('Character pending_modifiers must be an array');
    for (const m of pending) {
      if (!m || typeof m !== 'object') failValidation('pending_modifiers entries must be objects');
      if (typeof m.value !== 'number' || !Number.isFinite(m.value)) {
        failValidation('pending_modifiers entry must have numeric value');
      }
      if (m.source !== undefined && typeof m.source !== 'string') {
        failValidation('pending_modifiers entry source must be a string');
      }
    }
  }
}

function validateNPCActionArrays(content) {
  for (const field of ['actions', 'legendary_actions', 'lair_actions', 'reactions', 'traits']) {
    const arr = content[field];
    if (arr === undefined) continue;
    if (!Array.isArray(arr)) failValidation(`NPC ${field} must be an array`);
    for (const action of arr) {
      if (!action || typeof action !== 'object') {
        failValidation(`NPC ${field} entries must be objects`);
      }
      if (typeof action.name !== 'string' || !action.name) {
        failValidation(`NPC ${field} entries must have a name string`);
      }
    }
  }
}

function validateCharacterAttributes(content, systemConfig) {
  if (!content.attributes || typeof content.attributes !== 'object') return;
  if (!systemConfig || !Array.isArray(systemConfig.attributes)) return;
  for (const attr of systemConfig.attributes) {
    const val = content.attributes[attr.key];
    if (val === undefined) continue;
    if (typeof val !== 'number') {
      failValidation(`Attribute ${attr.key} must be a number`);
    }
    const min = attr.min ?? 0;
    const max = attr.max ?? 99;
    if (val < min || val > max) {
      failValidation(`Attribute ${attr.key} must be between ${min} and ${max}`);
    }
  }
}

function validateCharacterNumericStats(content) {
  const numericStats = ['hp', 'max_hp', 'ac', 'initiative', 'hp_current', 'hp_max'];
  for (const stat of numericStats) {
    if (content[stat] !== undefined && typeof content[stat] !== 'number') {
      failValidation(`${stat} must be a number`);
    }
    if (content.stats && content.stats[stat] !== undefined && typeof content.stats[stat] !== 'number') {
      failValidation(`Character stats.${stat} must be number`);
    }
  }
}

export function validateInitiative(content) {
  failIfNotObject(content, 'Initiative');
  if (!Array.isArray(content.order)) {
    failValidation('Initiative order must be array');
  }
  for (const entry of content.order) {
    validateInitiativeEntry(entry);
  }
  if (content.current_index !== undefined && typeof content.current_index !== 'number') {
    failValidation('Initiative current_index must be number');
  }
  if (content.round !== undefined && typeof content.round !== 'number') {
    failValidation('Initiative round must be number');
  }
  return true;
}

function validateInitiativeEntry(entry) {
  if (!entry.id || typeof entry.id !== 'string') failValidation('Initiative entry must have id');
  if (!entry.character_id || typeof entry.character_id !== 'string') failValidation('Initiative entry must have character_id');
  if (typeof entry.initiative !== 'number') failValidation('Initiative entry must have numeric initiative');
  if (!entry.name || typeof entry.name !== 'string') failValidation('Initiative entry must have name');
  if (!entry.token_id || typeof entry.token_id !== 'string') failValidation('Initiative entry must have token_id');
  for (const flag of ['action_used', 'bonus_action_used', 'reaction_used']) {
    if (flag in entry && typeof entry[flag] !== 'boolean') {
      failValidation(`Initiative entry ${flag} must be boolean`);
    }
  }
}
