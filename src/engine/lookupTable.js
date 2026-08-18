/**
 * Generic table lookup for ruleset data.
 *
 * Default behaviour: exact match by string-coerced key, returns null on miss.
 *
 * Options:
 *   clamp: 'nearest' - for numeric keys, return the nearest key's value
 *                      when input is outside the defined range.
 *   clamp: 'floor'   - return the highest defined key ≤ input (useful for
 *                      XP→level and similar threshold lookups). Returns
 *                      null when input is below the smallest key.
 *
 * Ruleset authors choose the lookup behaviour by picking which mode the
 * caller uses - the table shape stays a plain object of key→value.
 */

/**
 * @param {Record<string, any>} table
 * @param {string|number} key
 * @param {{ clamp?: 'nearest'|'floor' }} [options]
 */
export function lookupTable(table, key, { clamp } = {}) {
  if (!table || typeof table !== 'object') return null;

  const exact = table[key] ?? table[String(key)];
  if (exact !== undefined) return exact;

  if (!clamp) return null;

  const numericKeys = Object.keys(table)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (numericKeys.length === 0) return null;

  const n = Number(key);
  if (!Number.isFinite(n)) return null;

  if (clamp === 'nearest') {
    if (n <= numericKeys[0]) return readKey(table, numericKeys[0]);
    if (n >= numericKeys[numericKeys.length - 1]) return readKey(table, numericKeys[numericKeys.length - 1]);
    return null;
  }

  if (clamp === 'floor') {
    let best = null;
    for (const k of numericKeys) {
      if (k <= n) best = k;
      else break;
    }
    return best === null ? null : readKey(table, best);
  }

  return null;
}

function readKey(table, k) {
  return table[k] ?? table[String(k)] ?? null;
}
