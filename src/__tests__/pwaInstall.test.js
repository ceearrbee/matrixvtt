/**
 * The install affordance appears only when the browser offers one.
 *
 * `beforeinstallprompt` fires once, early, and must be captured and
 * held: the event cannot be raised on demand later. Browsers that
 * never fire it, and a session already running installed, must show
 * nothing rather than a button that cannot work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureInstallPrompt, installAvailable, promptInstall, resetInstallPrompt,
} from '../ui/pwa/install.js';
import { buildGlobalMenuItems } from '../ui/global-menu-items.js';

function fakeEvent() {
  return { preventDefault: vi.fn(), prompt: vi.fn().mockResolvedValue(undefined) };
}

const ui = /** @type {any} */ ({
  state: { isGM: () => false },
  widgetManager: { isAppClient: true, canLeave: false },
});

beforeEach(() => {
  resetInstallPrompt();
  document.body.innerHTML = '';
});

describe('the captured prompt', () => {
  it('is unavailable until the browser offers one', () => {
    expect(installAvailable()).toBe(false);
  });

  it('is available once the browser fires the event', () => {
    captureInstallPrompt(fakeEvent());
    expect(installAvailable()).toBe(true);
  });

  it('stops the browser showing its own bar, so the offer is ours to place', () => {
    const e = fakeEvent();
    captureInstallPrompt(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('shows the browser prompt when asked', async () => {
    const e = fakeEvent();
    captureInstallPrompt(e);
    await promptInstall();
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('can only be spent once, because the event cannot be reused', async () => {
    const e = fakeEvent();
    captureInstallPrompt(e);
    await promptInstall();
    expect(installAvailable()).toBe(false);
    await promptInstall();
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('does nothing when nothing was captured', async () => {
    await expect(promptInstall()).resolves.toBeUndefined();
  });
});

describe('the menu entry', () => {
  const keys = () => buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).map((i) => i.key);

  it('is absent when the browser has not offered an install', () => {
    expect(keys()).not.toContain('install');
  });

  it('appears once an install is on offer', () => {
    captureInstallPrompt(fakeEvent());
    expect(keys()).toContain('install');
  });

  it('carries the shape the menu renders', () => {
    captureInstallPrompt(fakeEvent());
    const item = buildGlobalMenuItems(ui, { isGM: false, canLeave: false })
      .find((i) => i.key === 'install');
    expect(typeof item.label).toBe('string');
    expect(typeof item.action).toBe('function');
    expect(item.group).toBeTruthy();
  });
});
