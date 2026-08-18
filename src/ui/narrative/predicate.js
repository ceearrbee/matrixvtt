/**
 * Disable-predicate evaluator for narrative-section primitives. Used
 * by `tagged_list#row_action` and `button_action` to gate their
 * buttons against a character resource (commonly fate_points <= 0).
 *
 * Only the `disable_when_lte` predicate shape is supported in this
 * slice - the spec was explicit about staying minimal.
 */

/**
 * @param {Record<string, unknown>} character
 * @param {{ field: string, value: number } | null | undefined} predicate
 * @returns {boolean}
 */
export function isDisabled(character, predicate) {
  if (!predicate || typeof predicate !== 'object') return false;
  const raw = character?.[predicate.field];
  const current = raw == null ? 0 : Number(raw);
  return Number.isFinite(current) && current <= Number(predicate.value);
}
