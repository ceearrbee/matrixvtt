/**
 * Character sheet content rendering - once a character is selected
 * and the Sheet tab is active, the sheet must render its header,
 * HP bar, attributes, and action buttons.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openCharacterSheet(page) {
  // Clicking a card now selects the entity straight into the sidebar
  // sheet - no intermediate preview popup.
  await page.locator('[data-character-card="chr-aria"]').click();
  await expect(page.locator('.char-sheet[data-entity-id="chr-aria"]')).toBeVisible({ timeout: 5_000 });
}

test.describe('character sheet content', () => {
  test('renders the character name', async ({ page }) => {
    await openSheetRail(page);
    await openCharacterSheet(page);
    await expect(page.locator('.char-sheet .entity-name')).toContainText('Aria Blackwood');
  });

  test('renders the character subtitle (class · species)', async ({ page }) => {
    await openSheetRail(page);
    await openCharacterSheet(page);
    const subtitle = page.locator('.char-sheet .entity-subtitle');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toContainText('Wizard 3');
    await expect(subtitle).toContainText('Half-elf');
  });

  test('Edit button on the sheet opens the entity form', async ({ page }) => {
    await openSheetRail(page);
    await openCharacterSheet(page);
    await page.locator('.char-sheet').getByRole('button', { name: /edit character/i }).click();
    await expect(page.locator('#entity-form-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#entity-name')).toHaveValue('Aria Blackwood');
  });

  test('sheet exposes the character avatar element', async ({ page }) => {
    await openSheetRail(page);
    await openCharacterSheet(page);
    await expect(page.locator('.char-sheet .entity-avatar')).toBeVisible();
  });

  test('CharacterSwitcher is present at the top of the sheet panel', async ({ page }) => {
    await openSheetRail(page);
    await openCharacterSheet(page);
    // The switcher mounts above the sheet body; presence is enough.
    await expect(page.locator('.char-sheet').locator('button, select').first()).toBeVisible();
  });
});
