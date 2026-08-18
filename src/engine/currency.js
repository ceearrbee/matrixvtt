/**
 * Generic coin aggregation for ruleset-driven currency.
 *
 * A character's `currency` is a Record<denominationKey, number>
 * (see `src/ui/character-sheet-sections/lists.js`). The ruleset declares
 * the denomination table at `currency.denominations[]`, each entry
 * `{ key, label, value_in_base, weight }` - `value_in_base` converts
 * one coin into the ruleset's base unit (e.g. copper pieces for D&D
 * 5e), `weight` is that coin's weight in the ruleset's weight unit.
 *
 * Rulesets that don't track coin weight or value (no `currency` table)
 * return null so callers can skip the carrying-capacity contribution
 * entirely rather than treating an empty pool as zero.
 */

/**
 * @param {Record<string, number>|undefined|null} holdings
 * @param {{ denominations?: Array<{ key: string, value_in_base?: number, weight?: number }> }|undefined|null} rulesetCurrency
 * @returns {{ totalValueInBase: number, totalWeight: number }|null}
 */
export function computeCurrencyTotals(holdings, rulesetCurrency) {
  const denominations = rulesetCurrency?.denominations;
  if (!Array.isArray(denominations) || denominations.length === 0) return null;

  const pool = (holdings && typeof holdings === 'object') ? holdings : {};

  let totalValueInBase = 0;
  let totalWeight = 0;
  for (const denom of denominations) {
    const count = Number(pool[denom.key]);
    if (!Number.isFinite(count) || count <= 0) continue;
    totalValueInBase += count * (Number(denom.value_in_base) || 0);
    totalWeight += count * (Number(denom.weight) || 0);
  }

  return { totalValueInBase, totalWeight };
}
