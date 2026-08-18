/**
 * NPC sheet content rendering - once an NPC is selected and the NPC
 * tab is active, the sheet must render header, subtitle, edit button.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openNPCSheet(page) {
  await page.locator('[data-tab="npc"]').click();
  // Clicking the card selects the NPC straight into the sidebar sheet.
  await page.locator('[data-npc-card="npc-orc"]').click();
  await expect(page.locator('[data-entity-id="npc-orc"]')).toBeVisible({ timeout: 5_000 });
}

test.describe('NPC sheet content', () => {
  test('renders the NPC name', async ({ page }) => {
    await openSheetRail(page);
    await openNPCSheet(page);
    await expect(page.locator('[data-entity-id="npc-orc"] .entity-name')).toContainText('Orc War Boss');
  });

  test('renders the NPC subtitle (CR · size)', async ({ page }) => {
    await openSheetRail(page);
    await openNPCSheet(page);
    await expect(page.locator('[data-entity-id="npc-orc"] .entity-subtitle')).toContainText('CR 2');
    await expect(page.locator('[data-entity-id="npc-orc"] .entity-subtitle')).toContainText('Medium');
  });

  test('Edit button opens the entity form pre-filled', async ({ page }) => {
    await openSheetRail(page);
    await openNPCSheet(page);
    await page.locator('[data-entity-id="npc-orc"]').getByRole('button', { name: /edit/i }).first().click();
    await expect(page.locator('#entity-form-modal')).toBeVisible();
    await expect(page.locator('#entity-name')).toHaveValue('Orc War Boss');
  });
});
