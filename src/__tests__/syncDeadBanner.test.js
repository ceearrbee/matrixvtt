/**
 * sync-dead reconnect banner - shown when the sync loop gives up after max retries.
 *
 * showSyncDeadBanner(container, onReconnect):
 *   - inserts a non-dismissable banner into `container`
 *   - the banner contains a "Reconnect" button
 *   - clicking "Reconnect" calls onReconnect()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showSyncDeadBanner } from '../ui/sync-status.js';

function makeContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('showSyncDeadBanner', () => {
  it('inserts a banner element into the container', () => {
    const container = makeContainer();
    showSyncDeadBanner(container);
    expect(container.querySelector('[data-sync-dead-banner]')).not.toBeNull();
  });

  it('banner contains a Reconnect button', () => {
    const container = makeContainer();
    showSyncDeadBanner(container);
    const btn = container.querySelector('[data-reconnect-btn]');
    expect(btn).not.toBeNull();
    expect(btn.textContent.toLowerCase()).toContain('reconnect');
  });

  it('calls onReconnect callback when button is clicked', () => {
    const container = makeContainer();
    const onReconnect = vi.fn();
    showSyncDeadBanner(container, onReconnect);
    container.querySelector('[data-reconnect-btn]').click();
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it('does not insert a second banner if called twice', () => {
    const container = makeContainer();
    showSyncDeadBanner(container);
    showSyncDeadBanner(container);
    expect(container.querySelectorAll('[data-sync-dead-banner]').length).toBe(1);
  });
});
