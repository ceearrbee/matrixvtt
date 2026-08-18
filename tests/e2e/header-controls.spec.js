/**
 * Global-menu controls: theme toggle, tour restart, settings, and the
 * header sync status indicator. Theme/tour/settings are consolidated
 * into the lower-left global menu; the sync badge stays in the header.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

async function openGlobalMenu(page) {
  await waitForVttShell(page);
  await page.locator('.left-index__menu-btn').click();
}

test.describe('header controls', () => {
  test('theme toggle flips data-theme', async ({ page }) => {
    await openGlobalMenu(page);
    const initial = await page.locator('html').getAttribute('data-theme');
    const btn = page.locator('[data-menu-item="theme"]');
    await expect(btn).toBeVisible();
    await btn.click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(initial);
  });

  test('tour restart control is present', async ({ page }) => {
    await openGlobalMenu(page);
    await expect(page.locator('[data-menu-item="tour"]')).toBeVisible();
  });

  test('sync status indicator shows a connection state', async ({ page }) => {
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
