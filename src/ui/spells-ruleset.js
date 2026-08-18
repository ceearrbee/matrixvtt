/**
 * Ruleset lookups for spell rendering.
 *
 * The spells tab reads four system-specific pieces from the ruleset
 * rather than hardcoding 5e tables:
 *   - icon for a given school key
 *   - display label for a given level
 *   - which field to group spells by (level / circle / tier)
 *   - which levels have spell slots (for the slot grid)
 *
 * Each helper degrades cleanly: unknown school ⇒ book emoji, unknown
 * level ⇒ "Level N", no group_by ⇒ 'level', no slot_levels ⇒ [].
 */

export function getSpellSchoolIcon(systemConfig, schoolKey) {
  const list = systemConfig?.spell_schools;
  if (!Array.isArray(list)) return '📖';
  for (const entry of list) {
    if (entry?.key === schoolKey && entry?.icon) return entry.icon;
    if (entry?.label === schoolKey && entry?.icon) return entry.icon;
  }
  return '📖';
}

export function getSpellLevelLabel(systemConfig, level) {
  const labels = systemConfig?.spellcasting?.level_labels;
  const key = String(level);
  if (labels && labels[key]) return labels[key];
  return `Level ${level}`;
}

export function getSpellGroupKey(systemConfig, spell) {
  const field = systemConfig?.spellcasting?.group_by ?? 'level';
  const value = spell?.[field];
  return value ?? 0;
}

export function getSpellSlotLevels(systemConfig) {
  const levels = systemConfig?.spellcasting?.slot_levels;
  return Array.isArray(levels) ? levels : [];
}
