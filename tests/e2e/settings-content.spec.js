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

  test('Delete campaign sits behind the Advanced disclosure in About', async ({ page }) => {
    await openSettings(page);
    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    // Not in the footer that renders on every tab, including Appearance.
    await expect(dialog.locator('.form-actions').getByRole('button', { name: /delete campaign/i }))
      .toHaveCount(0);

    await page.getByRole('tab', { name: /about/i }).click();
    const advanced = dialog.locator('[data-settings-advanced]');
    await expect(advanced).toBeVisible();
    await advanced.locator('summary').click();
    await expect(advanced.getByRole('button', { name: /delete campaign/i })).toBeVisible();
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

  // Scoped to the About panel: "homeserver" also appears in the
  // campaign settings hint about shrinking map uploads, and a bare text
  // match resolved to both.
  test('shows the homeserver row when connected', async ({ page }) => {
    await openAbout(page);
    const about = page.locator('#settings-modal');
    await expect(about.getByText('Homeserver', { exact: true })).toBeVisible();
    await expect(about.getByText('https://fake.matrix.test')).toBeVisible();
  });

  test('shows the API status row', async ({ page }) => {
    await openAbout(page);
    await expect(page.getByText(/api status/i)).toBeVisible();
  });
});
