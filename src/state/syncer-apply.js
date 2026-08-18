/**
 * applySettings - resolves the systemConfig preset from the system slug
 * and mirrors active_map_id onto sm.activeMapId. Called by the settings
 * bridge in stateManager-yjs-bridges.js.
 *
 * Read half of the SETTINGS write/read symmetry. The strip half lives
 * in `./settings-marshal.js#stripSystemConfigForWrite` - outbound writes
 * drop `systemConfig`, this function re-derives it from the slug.
 */

import { DEFAULTS } from '../utils/constants.js';
import { getGameSystemPresets } from './rulesets.js';

export function applySettings(sm, content) {
  if (!content || Object.keys(content).length === 0) {
    sm.settings = { name: '', system: 'generic', gm_user_ids: [], grid_px: DEFAULTS.GRID_PX };
    return;
  }

  // reassign so the signal publishes once. Priority for systemConfig:
  //   1. Inline systemConfig persisted in room state (custom rulesets,
  //      imported .vttruleset.json).
  //   2. Named preset from the built-in registry.
  //   3. Null - the UI will prompt the GM to pick a system.
  // Events arrive with systemConfig stripped, so a slug change must
  // re-resolve rather than let the previous system's resolved config
  // survive the merge.
  const next = { ...sm.settings, ...content };
  const systemChanged =
    typeof content.system === 'string' && content.system !== sm.settings?.system;
  if (!content.systemConfig && next.system && (systemChanged || !next.systemConfig)) {
    const presets = getGameSystemPresets();
    const preset = presets[next.system] || null;
    next.systemConfig = preset;
    if (!preset) {
      next._system_missing = next.system;
    } else {
      delete next._system_missing;
    }
  }
  sm.settings = next;

  // Adopt the incoming active_map_id even if the matching map event
  // hasn't arrived yet (sync ordering isn't guaranteed). `getActiveMap`
  // in reader.js is the guard that falls back to the first available
  // map if the pointer ends up stale.
  if (content.active_map_id !== undefined) sm.activeMapId = content.active_map_id;
}
