/**
 * The prompt is a bar, not a toast.
 *
 * The toast wrapper does not expose an action button, and its only
 * sticky level is the error styling. A new version is not an error and
 * a prompt that vanishes in four seconds is worse than none, so this
 * follows the offline banner: a closure-owned node with a disposer.
 *
 * It is dismissable. An update the player cannot postpone is the same
 * disrespect as one that installs itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showUpdateBanner, hideUpdateBanner } from '../ui/pwa/update-banner.js';

beforeEach(() => {
  document.body.innerHTML = '';
  hideUpdateBanner();
});

const banner = () => document.querySelector('[data-pwa-update-banner]');

describe('the update banner', () => {
  it('says a new version is ready', () => {
    showUpdateBanner(document.body, vi.fn());
    expect(banner()).toBeTruthy();
    expect(banner().textContent.toLowerCase()).toContain('new version');
  });

  it('announces politely, because nothing is wrong', () => {
    showUpdateBanner(document.body, vi.fn());
    expect(banner().getAttribute('role')).toBe('status');
  });

  it('reloads on the player’s word', () => {
    const onReload = vi.fn();
    showUpdateBanner(document.body, onReload);
    banner().querySelector('[data-pwa-update-reload]').click();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('can be put off', () => {
    showUpdateBanner(document.body, vi.fn());
    banner().querySelector('[data-pwa-update-dismiss]').click();
    expect(banner()).toBeNull();
  });

  it('does not stack when shown twice', () => {
    showUpdateBanner(document.body, vi.fn());
    showUpdateBanner(document.body, vi.fn());
    expect(document.querySelectorAll('[data-pwa-update-banner]')).toHaveLength(1);
  });

  it('can be taken down by its owner', () => {
    showUpdateBanner(document.body, vi.fn());
    hideUpdateBanner();
    expect(banner()).toBeNull();
  });

  it('builds its buttons as elements, not by interpolating markup', () => {
    showUpdateBanner(document.body, vi.fn());
    expect(banner().querySelector('[data-pwa-update-reload]').tagName).toBe('BUTTON');
  });
});
