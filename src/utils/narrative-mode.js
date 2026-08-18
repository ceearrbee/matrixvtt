/**
 * narrative-mode.js - single source of truth for "is this room running
 * a narrative-heavy ruleset?"
 *
 * Three sources in precedence order:
 *   1. settings.narrative_mode_override === 'on' | 'off'  - GM force
 *   2. settings.systemConfig.narrative                    - ruleset flag
 *   3. false                                              - tactical default
 *
 * The override is tri-state ('on' / 'off' / undefined-or-'auto') so the
 * GM's "inherit from ruleset" choice is representable. A plain boolean
 * would collapse the auto case.
 */

export function isNarrativeMode(state) {
  const settings = state?.settings;
  if (!settings) return false;
  if (settings.narrative_mode_override === 'on') return true;
  if (settings.narrative_mode_override === 'off') return false;
  return !!settings.systemConfig?.narrative;
}
