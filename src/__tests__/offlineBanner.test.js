/**
 * Offline banner - appears when navigator.onLine is false (or an
 * `offline` event fires), removes when an `online` event fires.
 * Distinct from the rate-limit banner: this signals the browser
 * itself has lost connectivity.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wireOfflineBanner } from '../ui/sync/offline-banner.js';

const BANNER_ID = 'offline-banner';

function setOnLine(value) {
  Object.defineProperty(window.navigator, 'onLine', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('offline-banner', () => {
  let dispose;

  beforeEach(() => {
    setOnLine(true);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (typeof dispose === 'function') dispose();
    dispose = null;
    document.body.innerHTML = '';
  });

  it('does not render the banner when starting online', () => {
    dispose = wireOfflineBanner();
    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('renders the banner when an offline event fires', () => {
    dispose = wireOfflineBanner();
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    const banner = document.getElementById(BANNER_ID);
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
    expect(banner.textContent).toMatch(/offline/i);
  });

  it('removes the banner when an online event fires', () => {
    dispose = wireOfflineBanner();
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(document.getElementById(BANNER_ID)).not.toBeNull();

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('renders the banner immediately when wired while offline', () => {
    setOnLine(false);
    dispose = wireOfflineBanner();
    expect(document.getElementById(BANNER_ID)).not.toBeNull();
  });

  it('disposer detaches listeners and removes any existing banner', () => {
    setOnLine(false);
    dispose = wireOfflineBanner();
    expect(document.getElementById(BANNER_ID)).not.toBeNull();

    dispose();
    dispose = null;
    expect(document.getElementById(BANNER_ID)).toBeNull();

    window.dispatchEvent(new Event('offline'));
    expect(document.getElementById(BANNER_ID)).toBeNull();
  });

  it('repeat offline events do not stack banners', () => {
    dispose = wireOfflineBanner();
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    expect(document.querySelectorAll(`#${BANNER_ID}`).length).toBe(1);
  });
});
