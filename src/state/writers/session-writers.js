/**
 * session-writers.js - session-level settings and active-map switching.
 */

import { isGM } from '../reader.js';
import { VTTError, ErrorType } from '../../utils/errorHandling.js';
import { EVENT_TYPES, isUiMode } from '../../utils/constants.js';
import { getGameSystemPresets } from '../rulesets.js';

/**
 * GM-only: broadcast a suggested UI mode for the table. Players receive
 * it on the syncer side and surface a non-blocking banner; the local GM
 * is echo-suppressed by the syncer so their own pick doesn't banner-spam
 * them. The event is single-keyed (state_key '') - only the most recent
 * suggestion is meaningful, so LWW semantics are exactly what we want.
 */
export async function broadcastSuggestedMode(sm, mode) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, 'Only the GM can broadcast a suggested mode.');
  if (!isUiMode(mode)) throw new VTTError(ErrorType.VALIDATION, `Unknown UI mode: ${mode}`);
  return sm.sendStateEvent(EVENT_TYPES.UI_MODE, '', { mode });
}

export async function updateSettings(sm, next) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, 'Only the GM can change session settings.');
  // For builtin system slugs, systemConfig re-resolves from the preset
  // at read time, so it is stripped to keep the record small. Custom
  // slugs (imported .vttruleset.json) have no preset to resolve from;
  // their inline config must persist or the system is gone on the next
  // settings apply. _system_missing is a runtime flag, never persisted.
  const { systemConfig, _system_missing: _drop, ...rest } = next ?? {};
  const isBuiltin = !!getGameSystemPresets()[rest.system];
  sm.yjs.settingsMap.set('', isBuiltin || !systemConfig ? rest : { ...rest, systemConfig });
}

export async function setActiveMap(sm, mapId) {
  const next = { ...sm.settings, active_map_id: mapId };
  return updateSettings(sm, next);
}
