/**
 * Settings modal content - verifies the GM-only and shared sections
 * are rendered correctly for the seeded GM user.
 */
import { test, expect, openSettings } from './fixtures/logged-in.js';

test.describe('settings modal content', () => {
  test('GM sees the gm_user_ids textarea', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#settings-gms')).toBeVisible();
  });

  test('seeded GM user appears in the GM list', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#settings-gms')).toContainText('@playwright:fake.matrix.test');
  });

  test('Save button is present in the action row', async ({ page }) => {
    await openSettings(page);
    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    await expect(dialog.getByRole('button', { name: /save/i }).first()).toBeVisible();
  });

  test('Delete Session button is present for GM (destructive action)', async ({ page }) => {
    await openSettings(page);
    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    await expect(dialog.getByRole('button', { name: /delete session/i })).toBeVisible();
  });
});

test.describe('settings modal - API status panel', () => {
  // The sync/API status now lives in the About section of the settings rail.
  const openAbout = async (page) => {
    await openSettings(page);
    await page.getByRole('tab', { name: /about/i }).click();
  };

  test('shows the MatrixVTT version row (regression for dc3617f BUILD_VERSION)', async ({ page }) => {
    await openAbout(page);
    await expect(page.getByText('MatrixVTT version')).toBeVisible();
  });

  test('shows the homeserver row when connected', async ({ page }) => {
    await openAbout(page);
    await expect(page.getByText('Homeserver')).toBeVisible();
    await expect(page.getByText('https://fake.matrix.test')).toBeVisible();
  });

  test('shows the API status row', async ({ page }) => {
    await openAbout(page);
    await expect(page.getByText(/api status/i)).toBeVisible();
  });
});
