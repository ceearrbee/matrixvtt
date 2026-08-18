import * as v from 'valibot';

/**
 * Form field reading helper. Accepts multiple candidate IDs so callers stay
 * resilient to markup renames.
 */
export class FormReader {
  constructor(modal) {
    this.modal = modal;
  }

  getField(...ids) {
    for (const id of ids) {
      const field = this.modal.querySelector(`#${id}`);
      if (field) return field.value || '';
    }
    return '';
  }

  getInt(...ids) {
    const value = this.getField(...ids);
    return parseInt(value) || 0;
  }

  getCheckbox(...ids) {
    for (const id of ids) {
      const field = this.modal.querySelector(`#${id}`);
      if (field) return field.checked;
    }
    return false;
  }

  getSelect(...ids) {
    return this.getField(...ids);
  }

  collect(schema, options = { nullify: true }) {
    const data = {};
    for (const [prop, config] of Object.entries(schema)) {
      const ids = resolveIds(config);
      const type = config.type || 'text';
      const value = readField(this, type, ids);
      data[prop] = options.nullify && value === '' ? null : value;
    }
    return data;
  }

  /**
   * Read the fields described by `fields` from the DOM, validate the collected
   * object against the Valibot `schema`, and return `{ values, errors }`.
   *
   * `fields` is `{ [prop]: { id | ids, type } }` - it drives DOM reading (and
   * the bool/int/float coercion `collect` uses) and is reused by
   * `applyFieldErrors` to locate each input. `errors` is `{ [prop]: message }`
   * and only contains failing keys (empty on success). `values` matches
   * `collect`'s output (coerced, blank strings nullified) regardless of the
   * validation outcome - blank numerics there stay `0`, the same as before.
   *
   * Blank numeric inputs are passed to Valibot as `undefined` (not `0`) so a
   * required numeric field fails the `v.number()` type check ("required")
   * rather than a misleading min-bound message.
   */
  validate(fields, schema) {
    const values = {};
    const input = {};
    for (const [prop, config] of Object.entries(fields)) {
      const ids = resolveIds(config);
      const type = config.type || 'text';
      const value = readField(this, type, ids);
      values[prop] = value === '' ? null : value;
      input[prop] = readForValidation(this, type, ids);
    }
    const result = v.safeParse(schema, input);
    const errors = {};
    if (!result.success) {
      for (const issue of result.issues) {
        const key = issue.path?.[0]?.key;
        if (key && !(key in errors)) errors[key] = issue.message;
      }
    }
    return { values, errors };
  }
}

function resolveIds(config) {
  if (typeof config === 'string') return [config];
  if (Array.isArray(config.ids)) return config.ids;
  return [config.id];
}

function readForValidation(form, type, ids) {
  if (type === 'bool') return form.getCheckbox(...ids);
  const raw = form.getField(...ids);
  if (type === 'int' || type === 'float') {
    if (raw === '') return undefined;
    const n = type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
    return Number.isNaN(n) ? undefined : n;
  }
  return raw;
}

/**
 * Render the current `errors` map onto the form DOM. Sets `aria-invalid`,
 * `aria-describedby`, `.field--invalid` on each invalid input, and inserts
 * (or removes) a sibling `<div role="alert">` with the message. Focuses the
 * first invalid input.
 */
export function applyFieldErrors(modal, errors, schema) {
  let firstInvalid = null;
  for (const [prop, config] of Object.entries(schema)) {
    const ids = resolveIds(config);
    let input = null;
    for (const id of ids) {
      input = modal.querySelector(`#${id}`);
      if (input) break;
    }
    if (!input) continue;
    const errorId = `${input.id}-error`;
    const existing = modal.querySelector(`#${errorId}`);
    const msg = errors[prop];
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
      input.classList.add('field--invalid');
      if (existing) {
        existing.textContent = msg;
      } else {
        const div = document.createElement('div');
        div.id = errorId;
        div.className = 'form-error';
        div.setAttribute('role', 'alert');
        div.textContent = msg;
        input.insertAdjacentElement('afterend', div);
      }
      if (!firstInvalid) firstInvalid = input;
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      input.classList.remove('field--invalid');
      existing?.remove();
    }
  }
  firstInvalid?.focus();
}

function readField(form, type, ids) {
  if (type === 'int') return form.getInt(...ids);
  if (type === 'bool') return form.getCheckbox(...ids);
  if (type === 'float') return parseFloat(form.getField(...ids)) || 0;
  return form.getField(...ids);
}


