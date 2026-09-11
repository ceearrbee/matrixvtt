/**
 * session-writers.js - session-level settings and active-map switching.
 */

import { isGM } from '../reader.js';
import { VTTError, ErrorType } from '../../utils/errorHandling.js';
import { getGameSystemPresets } from '../rulesets.js';

export async function updateSettings(sm, next) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, 'Only the GM can change campaign settings.');
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
