/**
 * exhaustion.js - D&D 5e exhaustion tier helpers.
 *
 * Exhaustion is stored as token.exhaustion_level (integer 0–6).
 * Level 0 = no exhaustion.
 */

const EFFECTS = [
  null, // 0
  'Disadvantage on ability checks',
  'Speed halved; disadvantage on ability checks',
  'Speed halved; disadvantage on ability checks, attack rolls, and saving throws',
  'Hit point maximum halved; speed halved; disadvantage on ability checks, attack rolls, and saving throws',
  'Speed reduced to 0; all disadvantages and halved HP max',
  'Death',
];

/**
 * Return the cumulative mechanical effect description for an exhaustion level.
 * @param {number} level - 0 through 6
 * @returns {string | null} null if level is 0 or out of range
 */
export function getExhaustionEffect(level) {
  if (level < 0 || level > 6 || !Number.isInteger(level)) return null;
  return EFFECTS[level] ?? null;
}

/**
 * Short display label for a token's exhaustion level.
 * @param {number} level
 * @returns {string} e.g. "Exhaustion 3" or "" for 0
 */
export function formatExhaustionLabel(level) {
  if (!level || level <= 0) return '';
  return `Exhaustion ${level}`;
}
