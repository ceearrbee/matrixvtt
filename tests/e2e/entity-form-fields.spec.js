/**
 * Entity form (create/edit character or NPC) - field rendering and
 * type-toggle behavior.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function openAddCharacter(page) {
  await openSheetRail(page);
  // Reach the empty-state "Create Character" via switching to a tab
  // that lists characters and clicking the Add button. Here we open
  // the form directly via the global API hook (window.ui).
  await page.evaluate(() => window.matrixVTTClient.ui.showEntityForm('pc'));
  await expect(page.locator('#entity-form-modal')).toBeVisible({ timeout: 5_000 });
}

async function openEditCharacter(page) {
  await openSheetRail(page);
  // Cards select into the sidebar sheet now; open the edit form via the
  // same runtime hook openAddCharacter uses.
  await page.evaluate(() => window.matrixVTTClient.ui.showEditCharacterForm('chr-aria'));
  await expect(page.locator('#entity-form-modal')).toBeVisible({ timeout: 5_000 });
}

test.describe('entity form - Add Character', () => {
  test('opens the modal with a Character/NPC type selector', async ({ page }) => {
    await openAddCharacter(page);
    await expect(page.locator('input[name="entity-type"][value="pc"]')).toBeVisible();
    await expect(page.locator('input[name="entity-type"][value="npc"]')).toBeVisible();
  });

  test('PC type renders the character name input', async ({ page }) => {
    await openAddCharacter(page);
    await expect(page.locator('#entity-name')).toBeVisible();
    // Name field starts blank for a new character.
    await expect(page.locator('#entity-name')).toHaveValue('');
  });

  test('switching to NPC type reveals the NPC monster-details fields', async ({ page }) => {
    await openAddCharacter(page);
    await page.locator('input[name="entity-type"][value="npc"]').check();
    // CommonBottomFields renders HP/AC/Speed for NPC.
    await expect(page.locator('#entity-hp-max')).toBeVisible();
    await expect(page.locator('#entity-ac')).toBeVisible();
    await expect(page.locator('#entity-speed')).toBeVisible();
  });

  test('Cancel closes the modal', async ({ page }) => {
    await openAddCharacter(page);
    await page.locator('#entity-form-modal').getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('#entity-form-modal')).toHaveCount(0);
  });

  test('Escape closes the modal', async ({ page }) => {
    await openAddCharacter(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#entity-form-modal')).toHaveCount(0);
  });
});

test.describe('entity form - Edit Character', () => {
  test('opens with the character name pre-filled', async ({ page }) => {
    await openEditCharacter(page);
    await expect(page.locator('#entity-name')).toHaveValue('Aria Blackwood');
  });

  test('submit button reads "Update Character" when editing', async ({ page }) => {
    await openEditCharacter(page);
    await expect(page.locator('#entity-submit-btn')).toContainText(/update/i);
  });

  test('clicking outside (overlay) closes the edit modal', async ({ page }) => {
    await openEditCharacter(page);
    // The overlay element has the click-to-close handler.
    await page.locator('#entity-form-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#entity-form-modal')).toHaveCount(0);
  });
});
