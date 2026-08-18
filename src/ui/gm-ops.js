/**
 * gm-ops.js - barrel re-export for GM campaign operations.
 *   - gm/entity-ops.js : long rest, XP / level-up, HP adjust / set
 *   - gm/fog-ops.js    : fog toggle / reveal-all / hide-all
 *   - gm/bulk-ops.js   : heal-all / clear-all-conditions (per-token loops)
 *   - gm/state-export.js : one-off JSON snapshot
 */

export { applyLongRest, adjustXP, adjustHP, adjustTokenHP, setHP } from './gm/entity-ops.js';
export { toggleFog, revealAllFog, hideAllFog } from './gm/fog-ops.js';
export { healAll, clearAllConditions } from './gm/bulk-ops.js';
export { exportState } from './gm/state-export.js';
