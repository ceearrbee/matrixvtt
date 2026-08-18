/**
 * Spell form (ui.showSpellForm). Spells live in the Spells tab,
 * gated by the ruleset's `spell_schools` list. The form itself is
 * always openable via ui.showSpellForm() - used by the GM and by
 * characters when adding to their spellbook.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openSpellForm(page) {
  await openSheetRail(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showSpellForm());
  await expect(page.locator('#spell-form-modal')).toBeVisible({ timeout: 5_000 });
}

test.describe('spell form', () => {
  test('opens with a name input', async ({ page }) => {
    await openSpellForm(page);
    await expect(page.locator('#spell-name')).toBeVisible();
  });

  test('exposes level input', async ({ page }) => {
    await openSpellForm(page);
    await expect(page.locator('#spell-level')).toBeVisible();
  });

  test('has concentration + ritual checkboxes', async ({ page }) => {
    await openSpellForm(page);
    await expect(page.locator('#spell-concentration')).toBeVisible();
    await expect(page.locator('#spell-ritual')).toBeVisible();
  });

  test('Escape closes the spell form', async ({ page }) => {
    await openSpellForm(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#spell-form-modal')).toHaveCount(0);
  });
});
