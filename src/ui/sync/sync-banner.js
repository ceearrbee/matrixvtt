/**
 * sync-banner.js - ephemeral banner at the bottom of the screen
 * showing queue depth and/or a rate-limit countdown. Updated when
 * queue/rate-limit state changes via `ui._updateSyncBanner()`.
 *
 * Kept imperative for now; the entire surface will move to a Preact
 * component once syncState is a signal. Split out of sync-status.js.
 */

import { queueCountSignal } from '../../state/ui-signals.js';

const BANNER_ID = 'rate-limit-banner';

// Closure-owned reference - see offline-banner.js for the rationale.
// The DOM id is retained as a stable external selector for tests /
// devtools, but ownership lives here so `getElementById(...).remove()`
// is never the cleanup path.
let _banner = null;

function _getSyncBannerText(queueCount, rateLimitSeconds) {
  const rateLimited = rateLimitSeconds > 0;
  const s = queueCount === 1 ? '' : 's';
  if (rateLimited && queueCount > 0) return `${queueCount} change${s} queued, resuming in ${rateLimitSeconds}s`;
  if (rateLimited) return `Server rate limit reached, resuming in ${rateLimitSeconds}s`;
  return `Syncing ${queueCount} queued change${s}…`;
}

export function updateSyncBanner(ui) {
  const queueCount = queueCountSignal.value;
  const hasQueue = queueCount > 0;

  if (ui._rateLimitSeconds <= 0 && !hasQueue) {
    if (_banner) {
      _banner.remove();
      _banner = null;
    }
    clearInterval(ui._rateLimitInterval);
    ui._rateLimitInterval = null;
    return;
  }

  if (!_banner) {
    _banner = document.createElement('div');
    _banner.id = BANNER_ID;
    _banner.className = 'rate-limit-banner';
    _banner.setAttribute('role', 'status');
    _banner.setAttribute('aria-live', 'polite');
    document.body.appendChild(_banner);
  }

  _banner.textContent = _getSyncBannerText(queueCount, ui._rateLimitSeconds);

  if (ui._rateLimitSeconds > 0 && !ui._rateLimitInterval) {
    ui._rateLimitInterval = setInterval(() => {
      ui._rateLimitSeconds = Math.max(0, ui._rateLimitSeconds - 1);
      ui._updateSyncBanner();
    }, 1000);
  } else if (ui._rateLimitSeconds <= 0 && ui._rateLimitInterval) {
    clearInterval(ui._rateLimitInterval);
    ui._rateLimitInterval = null;
  }
}

/**
 * Show a non-dismissable "sync dead" banner inside `container`.
 * Repeated calls on the same container are no-ops.
 *
 * @param {Element} container
 * @param {(() => void) | undefined} onReconnect
 */
export function showSyncDeadBanner(container, onReconnect) {
  if (container.querySelector('[data-sync-dead-banner]')) return;
  const banner = document.createElement('div');
  banner.setAttribute('data-sync-dead-banner', '');
  banner.setAttribute('role', 'alert');
  banner.className = 'sync-dead-banner';
  banner.innerHTML = `
    <span>Lost connection to Matrix updates. The sync loop has stopped.</span>
    <button data-reconnect-btn class="dbt btn-primary" style="margin-left:12px;">Reconnect</button>
  `;
  banner.querySelector('[data-reconnect-btn]').addEventListener('click', () => {
    if (typeof onReconnect === 'function') onReconnect();
  });
  container.appendChild(banner);
}
