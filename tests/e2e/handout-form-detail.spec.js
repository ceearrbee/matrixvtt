/**
 * Handout form details - title, content, visibility toggle, image url.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openHandoutForm(page) {
  await openSheetRail(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showHandoutForm());
  await expect(page.locator('#handout-form-modal')).toBeVisible({ timeout: 5_000 });
}

test.describe('handout form details', () => {
  test('opens with a visibility checkbox for GM', async ({ page }) => {
    await openHandoutForm(page);
    await expect(page.locator('#handout-visible')).toBeVisible();
  });

  test('Escape closes the form', async ({ page }) => {
    await openHandoutForm(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#handout-form-modal')).toHaveCount(0);
  });

  test('form has at least one text input or textarea', async ({ page }) => {
    await openHandoutForm(page);
    const inputs = page.locator('#handout-form-modal input[type="text"], #handout-form-modal textarea');
    await expect(inputs.first()).toBeVisible();
  });
});
