/**
 * Global-menu controls: settings, and the header sync status
 * indicator. Theme is the labelled select in Settings > Appearance -
 * the menu's blind five-way cycler is gone, and so is the spotlight
 * tour it sat beside.
 */
import { test, expect, waitForVttShell, openGlobalMenu } from './fixtures/logged-in.js';

test.describe('header controls', () => {
  test('carries no second theme control and no tour restart', async ({ page }) => {
    await openGlobalMenu(page);
    await expect(page.locator('[data-menu-item="settings"]')).toBeVisible();
    await expect(page.locator('[data-menu-item="theme"]')).toHaveCount(0);
    await expect(page.locator('[data-menu-item="tour"]')).toHaveCount(0);
  });

  test('reads as grouped sections rather than a flat list', async ({ page }) => {
    await openGlobalMenu(page);
    const groups = page.locator('.global-menu__group');
    expect(await groups.count()).toBeGreaterThan(1);
  });

  test('sync status indicator shows a connection state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the header sync chip is hidden in the phone layout');
    await waitForVttShell(page);
    const badge = page.locator('[data-sync-status]');
    await expect(badge).toBeVisible();
    // The badge text reads "● Live" or "↻ Reconnecting…" depending on
    // status; either is acceptable for "shows a state".
    const txt = (await badge.textContent()) ?? '';
    expect(txt.length).toBeGreaterThan(0);
  });

  test('settings control is present in the global menu', async ({ page }) => {
    await openGlobalMenu(page);
    await expect(page.locator('[data-menu-item="settings"]')).toBeVisible();
  });
});
