/**
 * Slash-key command palette. Opens via `/` and offers filtered
 * commands (switch tab, open modal, etc).
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

test.describe('command palette', () => {
  test('Slash opens the palette', async ({ page }) => {
    await waitForVttShell(page);
    await page.locator('body').focus();
    await page.keyboard.press('/');
    // Palette modal uses id="command-palette" per command-palette.js.
    await expect(page.locator('#command-palette')).toBeVisible({ timeout: 5_000 });
  });

  test('palette has a search input that takes focus', async ({ page }) => {
    await waitForVttShell(page);
    await page.locator('body').focus();
    await page.keyboard.press('/');
    const palette = page.locator('#command-palette');
    await expect(palette).toBeVisible();
    const input = palette.locator('input[type="text"], input[type="search"]').first();
    await expect(input).toBeFocused();
  });

  test('Escape closes the palette', async ({ page }) => {
    await waitForVttShell(page);
    await page.locator('body').focus();
    await page.keyboard.press('/');
    await expect(page.locator('#command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#command-palette')).toHaveCount(0);
  });
});
