/**
 * offline-banner.js - persistent banner shown while the browser is
 * offline (navigator.onLine === false). Distinct from the rate-limit
 * banner in `sync-banner.js`: rate-limit means Matrix is throttling
 * us, offline means the browser has no network at all.
 *
 * Kept imperative to match the existing sync-banner style; will move
 * to Preact when the rest of the sync UI does.
 */

const BANNER_ID = 'offline-banner';
const MESSAGE = 'You are offline. Changes will be queued and sent when you reconnect.';

// Closure-owned reference - the module owns both create and teardown
// of its DOM node so there's no document-lookup leak path.
// The DOM id is retained as a stable
// external selector for tests and devtools, but ownership lives here.
let _bannerEl = null;

function _showBanner() {
  if (_bannerEl) return;
  _bannerEl = document.createElement('div');
  _bannerEl.id = BANNER_ID;
  _bannerEl.className = 'offline-banner';
  _bannerEl.setAttribute('role', 'status');
  _bannerEl.setAttribute('aria-live', 'polite');
  _bannerEl.textContent = MESSAGE;
  document.body.appendChild(_bannerEl);
}

function _hideBanner() {
  if (!_bannerEl) return;
  _bannerEl.remove();
  _bannerEl = null;
}

/**
 * Wire offline/online listeners to the document body banner. Returns a
 * disposer that detaches listeners and removes any visible banner.
 */
export function wireOfflineBanner() {
  const onOffline = () => _showBanner();
  const onOnline = () => _hideBanner();

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  if (navigator.onLine === false) _showBanner();

  return function disposeOfflineBanner() {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    _hideBanner();
  };
}
