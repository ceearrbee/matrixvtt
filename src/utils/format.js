/**
 * Pure display-value formatting helpers.
 */

/**
 * HP as a percentage clamped to 0..100.
 */
export function getHPPercentage(entity) {
  if (!entity || !entity.hp_max || entity.hp_max <= 0) return 0;
  const current = entity.hp_current ?? 0;
  return Math.max(0, Math.min(100, (current / entity.hp_max) * 100));
}

/**
 * CSS variable reference for an HP bar color given a percentage.
 * Canvas rendering uses token.color directly and does not call this.
 */
export function getHPColor(percentage) {
  if (percentage >= 75) return 'var(--color-text-success)';
  if (percentage >= 40) return 'var(--color-text-warning)';
  return 'var(--color-text-danger)';
}

/**
 * Presentation-only HP breakpoints.
 * Used by `getHPZone` to set a `data-zone` attribute on hp-bar fills so
 * CSS can apply contrast-checked semantic colors via attribute selector
 * - no inline styles, no dependence on token brand color.
 *
 * These are UI thresholds (the visual line between "healthy" and
 * "bloodied"), not ruleset thresholds. Anything game-system-specific
 * (D&D's bloodied = ≤ ½, FATE consequences) belongs in
 * `src/state/rulesets.js`.
 */
export const HP_ZONES = Object.freeze({
  HEALTHY: 0.5,
  WOUNDED: 0.25,
});

export function getHPZone(entity) {
  if (!entity || !entity.hp_max || entity.hp_max <= 0) return 'unknown';
  const ratio = (entity.hp_current ?? 0) / entity.hp_max;
  if (ratio > HP_ZONES.HEALTHY) return 'healthy';
  if (ratio >= HP_ZONES.WOUNDED) return 'wounded';
  return 'critical';
}
