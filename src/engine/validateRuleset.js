/**
 * Validate a ruleset object against RULESET-SPEC.md.
 *
 * Returns { valid, errors, warnings }:
 *   - errors block loading (required fields, malformed AST, unknown ops)
 *   - warnings flag likely bugs but the ruleset still loads (e.g. a formula
 *     references a table that isn't defined).
 *
 * The validator is non-throwing - importers surface the messages.
 */

// Must match OPS keys in engine/evaluate.js
const KNOWN_OPS = new Set([
  '+', '-', '*', '/', 'floor', 'ceil', 'max', 'min',
  'eq', 'lt', 'gt', 'if', 'lookup', 'sum_items',
]);

const HARM_TYPES = new Set(['pool', 'tracks', 'stress', 'wounds']);

/**
 * Current ruleset spec version. Bump when the engine starts interpreting
 * a new field name or a semantic change breaks existing rulesets.
 * Rulesets declaring a higher version load with a warning (the engine
 * may ignore fields it doesn't understand yet).
 */
export const CURRENT_SPEC_VERSION = '1.0';

export function validateRuleset(rs) {
  const errors = [];
  const warnings = [];

  if (!rs || typeof rs !== 'object' || Array.isArray(rs)) {
    return { valid: false, errors: ['ruleset must be an object'], warnings: [] };
  }

  // Required: meta.name
  if (!rs.meta || typeof rs.meta.name !== 'string' || rs.meta.name.length === 0) {
    errors.push('meta.name is required');
  }

  // spec_version: optional (warns when absent), must be string, warn on future.
  if (rs.meta) {
    const declared = rs.meta.spec_version;
    if (declared === undefined) {
      warnings.push(`meta.spec_version missing; assuming ${CURRENT_SPEC_VERSION}. Future-proof your ruleset by declaring it.`);
    } else if (typeof declared !== 'string') {
      errors.push('meta.spec_version must be a string like "1.0"');
    } else if (declared !== CURRENT_SPEC_VERSION) {
      warnings.push(`meta.spec_version "${declared}" ≠ engine ${CURRENT_SPEC_VERSION}; unknown fields may be ignored`);
    }
  }

  // Required: attributes (non-empty, each has key+label)
  if (!Array.isArray(rs.attributes) || rs.attributes.length === 0) {
    errors.push('attributes must be a non-empty array');
  } else {
    rs.attributes.forEach((a, i) => {
      if (!a?.key)   errors.push(`attributes[${i}].key is required`);
      if (!a?.label) errors.push(`attributes[${i}].label is required`);
    });
  }

  // Required: dice.check
  if (!rs.dice?.check || typeof rs.dice.check !== 'string') {
    errors.push('dice.check is required');
  }

  // Optional: tables (must be objects of primitives)
  if (rs.tables !== undefined) {
    if (typeof rs.tables !== 'object' || Array.isArray(rs.tables)) {
      errors.push('tables must be an object');
    }
  }

  // Optional: formulas (must be well-formed AST)
  const declaredTables = new Set(Object.keys(rs.tables ?? {}));
  if (rs.formulas !== undefined) {
    if (typeof rs.formulas !== 'object' || Array.isArray(rs.formulas)) {
      errors.push('formulas must be an object');
    } else {
      for (const [name, formula] of Object.entries(rs.formulas)) {
        validateFormula(formula, `formulas.${name}`, errors, warnings, declaredTables);
      }
    }
  }

  // Optional: harm_model
  if (rs.harm_model !== undefined) {
    validateHarmModel(rs.harm_model, errors);
  }

  // Optional: section/overlay blocks. Every entry needs a kind; an
  // unknown kind is skipped at render time, but a missing kind is an
  // authoring mistake worth surfacing on import.
  const kindedBlocks = [
    ['character_sheet', 'sections'], ['npc_sheet', 'sections'], ['item_card', 'sections'],
    ['character_preview', 'sections'], ['npc_preview', 'sections'], ['item_preview', 'sections'],
    ['character_card', 'overlays'], ['token', 'overlays'],
  ];
  for (const [key, listName] of kindedBlocks) {
    const block = rs[key];
    if (block === undefined) continue;
    if (typeof block !== 'object' || Array.isArray(block)) {
      errors.push(`${key} must be an object`);
      continue;
    }
    const list = block[listName];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      errors.push(`${key}.${listName} must be an array`);
      continue;
    }
    list.forEach((entry, i) => {
      if (!entry?.kind) errors.push(`${key}.${listName}[${i}].kind is required`);
    });
  }

  // Optional: character_form
  if (rs.character_form !== undefined) {
    const fields = rs.character_form?.fields;
    if (!Array.isArray(fields)) {
      errors.push('character_form.fields must be an array');
    } else {
      fields.forEach((f, i) => {
        if (!f?.kind) errors.push(`character_form.fields[${i}].kind is required`);
        else if (f.kind === 'row' && !Array.isArray(f.fields)) {
          errors.push(`character_form.fields[${i}].fields is required for row fields`);
        }
      });
    }
  }

  // Optional: combat.common_actions
  if (rs.combat?.common_actions !== undefined) {
    if (!Array.isArray(rs.combat.common_actions)) {
      errors.push('combat.common_actions must be an array');
    } else {
      rs.combat.common_actions.forEach((a, i) => {
        if (!a?.label) errors.push(`combat.common_actions[${i}].label is required`);
      });
    }
  }

  // Optional: action_economy (an empty array means no per-turn pips)
  if (rs.action_economy !== undefined) {
    if (!Array.isArray(rs.action_economy)) {
      errors.push('action_economy must be an array');
    } else {
      rs.action_economy.forEach((slot, i) => {
        if (!slot?.key) errors.push(`action_economy[${i}].key is required`);
        if (!slot?.title) errors.push(`action_economy[${i}].title is required`);
      });
    }
  }

  // Optional: state_machines
  if (rs.state_machines !== undefined) {
    if (typeof rs.state_machines !== 'object') {
      errors.push('state_machines must be an object');
    } else {
      for (const [name, spec] of Object.entries(rs.state_machines)) {
        validateStateMachine(spec, `state_machines.${name}`, errors, warnings, declaredTables);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateFormula(node, path, errors, warnings, declaredTables) {
  if (node === null || node === undefined) return;
  if (typeof node === 'number' || typeof node === 'boolean' || typeof node === 'string') return;
  if (typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${path} must be a literal, @path string, or { $, args } node`);
    return;
  }
  if (!('$' in node)) {
    errors.push(`${path} is missing its "$" operator`);
    return;
  }
  if (!KNOWN_OPS.has(node.$)) {
    errors.push(`${path}: unknown op "${node.$}"`);
    return;
  }
  if (!Array.isArray(node.args)) {
    errors.push(`${path}.args must be an array`);
    return;
  }
  if (node.$ === 'lookup') {
    const [tableName] = node.args;
    if (typeof tableName === 'string' && !declaredTables.has(tableName)) {
      warnings.push(`${path}: $lookup references undeclared table "${tableName}"`);
    }
  }
  node.args.forEach((a, i) => validateFormula(a, `${path}.args[${i}]`, errors, warnings, declaredTables));
}

function validateHarmModel(hm, errors) {
  if (typeof hm !== 'object' || Array.isArray(hm)) {
    errors.push('harm_model must be an object');
    return;
  }
  if (!HARM_TYPES.has(hm.type)) {
    errors.push(`harm_model.type must be one of ${[...HARM_TYPES].join(', ')}`);
    return;
  }
  if (hm.type === 'pool' && !hm.track_key) {
    errors.push('harm_model(pool) requires track_key');
  }
  if (hm.type === 'tracks' && !Array.isArray(hm.tracks)) {
    errors.push('harm_model(tracks) requires tracks: string[]');
  }
  if (hm.type === 'stress' && !Array.isArray(hm.boxes)) {
    errors.push('harm_model(stress) requires boxes: number[]');
  }
  if (hm.type === 'wounds' && !Array.isArray(hm.thresholds)) {
    errors.push('harm_model(wounds) requires thresholds: [{tier, max}]');
  }
}

function validateStateMachine(spec, path, errors, warnings, declaredTables) {
  if (typeof spec !== 'object') {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!Array.isArray(spec.transitions)) {
    errors.push(`${path}.transitions must be an array`);
    return;
  }
  spec.transitions.forEach((t, i) => {
    validateFormula(t.when, `${path}.transitions[${i}].when`, errors, warnings, declaredTables);
    if (t.set && typeof t.set === 'object') {
      for (const [field, f] of Object.entries(t.set)) {
        validateFormula(f, `${path}.transitions[${i}].set.${field}`, errors, warnings, declaredTables);
      }
    }
  });
  if (spec.resolve && typeof spec.resolve === 'object') {
    for (const [field, f] of Object.entries(spec.resolve)) {
      validateFormula(f, `${path}.resolve.${field}`, errors, warnings, declaredTables);
    }
  }
}
