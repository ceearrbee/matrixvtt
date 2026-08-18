/**
 * campaign-init.js - blank-campaign bootstrap.
 */

import { DEFAULTS } from '../utils/constants.js';

function settingsRecord(sm, name, system) {
  const creatorUserId = sm.widgetManager.userId;
  const gm_user_ids = creatorUserId && creatorUserId !== '@unknown:server'
    ? [creatorUserId]
    : [];
  // systemConfig is resolved from the active ruleset on read; never
  // persisted (matches session-writers.updateSettings). `created_at`
  // and `session_id` were also written here but never read by any
  // production consumer - dropped to avoid orphan settings fields
  // confusing future maintainers (same status `tour_handout_id` had).
  return {
    name,
    system,
    gm_user_ids,
    grid_px: DEFAULTS.GRID_PX,
    active_map_id: null,
  };
}

export function initBlankCampaign(sm, campaignName = 'New Campaign', gameSystem = 'dnd5e') {
  sm._clearAllState({ clearYjs: true });
  const mapId = crypto.randomUUID();
  // One Y.Doc transaction so the bridge / transport / verify all see
  // a single coherent update instead of three intermediate states.
  sm.yjs.doc.transact(() => {
    const settings = { ...settingsRecord(sm, campaignName, gameSystem), active_map_id: mapId };
    sm.yjs.settingsMap.set('', settings);
    sm.yjs.mapsMap.set(mapId, {
      id: mapId, name: 'Empty Map', image_url: null,
      width_cells: 10, height_cells: 10, cell_px: 40,
      offset_x: 0, offset_y: 0,
    });
  });
}
