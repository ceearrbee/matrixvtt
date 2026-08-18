/**
 * Markdown import dialog - opened via ui.showImportMarkdownDialog().
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openImportDialog(page) {
  await openSheetRail(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showImportMarkdownDialog());
  await expect(page.locator('#import-md-modal')).toBeVisible({ timeout: 5_000 });
}

test.describe('markdown import dialog', () => {
  test('opens with the file-input affordance', async ({ page }) => {
    await openImportDialog(page);
    await expect(page.locator('#md-file-input')).toBeVisible();
  });

  test('Escape closes the dialog', async ({ page }) => {
    await openImportDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#import-md-modal')).toHaveCount(0);
  });
});
