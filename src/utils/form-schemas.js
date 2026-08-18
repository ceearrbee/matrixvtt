/**
 * Small Valibot schema builders for form fields. They exist so form modules
 * compose real `v.object({...})` schemas (validated through Valibot, the same
 * engine the state writers use) without repeating the same pipe + message
 * boilerplate across every numeric field. Messages match what FormReader's
 * inline error renderer surfaces to the user.
 */
import * as v from 'valibot';

export function reqText(label) {
  return v.pipe(v.string(), v.minLength(1, `${label} is required`));
}

/**
 * @param {string} label
 * @param {number} [min]
 * @param {number} [max]
 */
function numberInRange(label, min, max) {
  const required = v.number(`${label} is required`);
  if (typeof min === 'number' && typeof max === 'number') {
    return v.pipe(required, v.minValue(min, `${label} must be at least ${min}`), v.maxValue(max, `${label} must be at most ${max}`));
  }
  if (typeof min === 'number') {
    return v.pipe(required, v.minValue(min, `${label} must be at least ${min}`));
  }
  if (typeof max === 'number') {
    return v.pipe(required, v.maxValue(max, `${label} must be at most ${max}`));
  }
  return required;
}

/**
 * Integer/number field with an optional [min, max] range. Optional by
 * default - a blank input arrives as `undefined` and passes. Pass
 * `{ required: true }` to reject a blank input with "<label> is required".
 */
export function intRange(label, min, max, { required = false } = {}) {
  const number = numberInRange(label, min, max);
  return required ? number : v.optional(number);
}

export function optInt(label, min, max) {
  return v.optional(numberInRange(label, min, max));
}

export function optFloat(label, min, max) {
  return v.optional(numberInRange(label, min, max));
}
