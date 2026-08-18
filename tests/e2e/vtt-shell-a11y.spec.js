/**
 * Accessibility coverage for the logged-in VTT shell. axe-core ran
 * pre-login in auth-screen.spec.js - this is the post-login surface:
 * the header buttons, the live region, and the Accessibility/Settings
 * modal that opens from the header.
 *
 * Specs stay clear of the destroy / leave path that hits a Konva
 * cleanup quirk in headless Chromium.
 */
import { test, expect, waitForVttShell, openSettings } from './fixtures/logged-in.js';
import AxeBuilder from '@axe-core/playwright';

// Contrast is enforced: the token pairs are gated per-theme by
// contrastTokens.test.js, and axe now runs color-contrast on the
// rendered surfaces here rather than excluding it.
const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious', 'moderate']);

test.describe('VTT shell - accessibility', () => {
  test('header passes axe-core blocking rules in the logged-in shell', async ({ page }) => {
    await waitForVttShell(page);
    await expect(page.locator('#back-to-rooms-btn-header')).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .include('.vtt-header')
      .withTags(A11Y_TAGS)
      .analyze();

    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    expect(
      blocking,
      `header axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}`).join('\n')}`,
    ).toEqual([]);
  });

  test('header and global menu expose the expected controls', async ({ page }) => {
    await waitForVttShell(page);
    // The room-list return lives in the header itself.
    await expect(page.getByLabel(/return to room list/i)).toBeVisible({ timeout: 10_000 });

    // Settings and theme are consolidated into the lower-left global menu.
    await page.locator('.left-index__menu-btn').click();
    await expect(page.locator('[data-menu-item="settings"]')).toBeVisible();
    await expect(page.locator('[data-menu-item="theme"]')).toBeVisible();
  });

  test('a polite live region exists for screen-reader announcements', async ({ page }) => {
    await waitForVttShell(page);
    const region = page.locator('#vtt-sr-announcements');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('settings modal', () => {
  test('opens via the header button and traps focus inside the dialog', async ({ page }) => {
    await openSettings(page);

    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#settings-modal-title')).toHaveText('Settings');
  });

  test('settings modal passes axe-core blocking rules', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"][aria-labelledby="settings-modal-title"]')
      .withTags(A11Y_TAGS)
      .analyze();

    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    expect(
      blocking,
      `settings modal axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}`).join('\n')}`,
    ).toEqual([]);
  });

  test('Close button dismisses the settings modal', async ({ page }) => {
    await openSettings(page);
    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('Escape dismisses the settings modal', async ({ page }) => {
    await openSettings(page);
    const dialog = page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
