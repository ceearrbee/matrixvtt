/**
 * sync-status.js - barrel re-export for sync/display-name helpers.
 *   - sync/debug-bar.js     : dev debug bar + storage/reload actions
 *   - sync/sync-banner.js   : queue / rate-limit / sync-dead banners
 *                             + sync-status badge
 *   - sync/display-name.js  : debounced Matrix display-name push
 */

export {
  toggleDebugMode,
  copyDebugToken, clearDebugStorage, hardReload,
} from './sync/debug-bar.js';

export {
  updateSyncBanner, showSyncDeadBanner,
} from './sync/sync-banner.js';

export { syncDisplayName } from './sync/display-name.js';
