/**
 * progression.js - ruleset-driven XP/level progression resolvers.
 *
 * Rulesets declare `progression: { type, level_field, xp_table }` and
 * the referenced `tables.<xp_table>` map from level → cumulative XP.
 * 5e ships this; systems without a leveling progression (FATE, PbtA,
 * etc.) simply omit the block and the adjust-XP flow updates raw XP
 * without inferring a level bump.
 */

function _getProgression(ruleset) {
  const p = ruleset?.progression;
  if (!p || p.type !== 'levels_xp' || !p.xp_table) return null;
  const table = ruleset?.tables?.[p.xp_table];
  if (!table) return null;
  return { progression: p, table };
}

/**
 * Inverse lookup: the highest level whose XP threshold is ≤ `xp`.
 * Returns null if no progression exists in the ruleset.
 */
export function levelFromXp(ruleset, xp) {
  const r = _getProgression(ruleset);
  if (!r) return null;
  const entries = Object.entries(r.table)
    .map(([k, v]) => [Number(k), Number(v)])
    .filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  let lvl = entries[0]?.[0] ?? 1;
  for (const [k, v] of entries) if (xp >= v) lvl = k;
  return lvl;
}

/**
 * Returns the XP threshold of the next level above `currentLevel`, or
 * null if already at the progression's top level (or if there's no
 * progression).
 */
export function nextLevelThreshold(ruleset, currentLevel) {
  const r = _getProgression(ruleset);
  if (!r) return null;
  const levels = Object.keys(r.table).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const next = levels.find((l) => l > currentLevel);
  if (next == null) return null;
  return r.table[String(next)] ?? r.table[next] ?? null;
}
