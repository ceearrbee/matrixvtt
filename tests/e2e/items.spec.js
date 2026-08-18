/**
 * Items tab CRUD smoke. The Items panel lives in the right-side
 * SheetPanel and is reachable via the [data-tab="items"] button.
 * Items belong to the currently-selected character.
 *
 * The form is opened by `ui.showItemForm()` → ModalFactory.create.
 * The body is a static HTML template with FormReader-backed inputs
 * (items-tab.js). Submit calls ui.createItem / ui.updateItem.
 *
 * Specs avoid clicking Save (which dispatches a Matrix sendStateEvent
 * via the fake - works, but the success-toast / list-refresh dance
 * involves Yjs paths we don't fully emulate). They cover open, fill,
 * conditional-weapon-block, and close - i.e. the parts that catch
 * structural regressions in the form itself.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

async function selectCharacter(page) {
  // Items belong to the selected character; click the character card
  // first so ui.state.getCurrentCharacter() returns chr-aria. The card
  // now selects straight into the sidebar sheet (no preview popup).
  await page.locator('[data-character-card="chr-aria"]').click();
  await expect(page.locator('.char-sheet[data-entity-id="chr-aria"]')).toBeVisible({ timeout: 5_000 });
}

test.describe('items tab', () => {
  test('switches to items tab and shows the panel', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    await expect(page.locator('#companion-content')).toBeVisible();
  });

  test('Add Item button opens the form modal', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    const addBtn = page.locator('[data-tab="items"]').locator('..').locator('..')
      .getByRole('button', { name: /add item|new item|^add$/i }).first();
    // Some rulesets render "+ Add Item"; fall back to any visible button
    // matching "add" near the items list.
    const fallback = page.getByRole('button', { name: /add item/i }).first();
    const target = (await addBtn.count()) > 0 ? addBtn : fallback;
    await target.click();
    await expect(page.locator('#item-form-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#item-name')).toBeVisible();
  });

  test('item form weapon-properties is visible by default (no type set)', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    await page.getByRole('button', { name: /add new item/i }).first().click();
    await expect(page.locator('#item-form-modal .modal-body')).toHaveAttribute('data-weapon-shaped', '');
  });

  test('typing a non-weapon type hides the weapon-properties block', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    await page.getByRole('button', { name: /add new item/i }).first().click();
    await expect(page.locator('#item-form-modal')).toBeVisible();
    await page.locator('#item-type').fill('note');
    // The CSS rule `.modal-body:not([data-weapon-shaped]) .weapon-properties { display: none }`
    // hides the block when the attribute is absent. Locator visibility honours that.
    await expect(page.locator('#item-form-modal .weapon-properties')).toBeHidden();
  });

  test('switching back to a weapon type re-shows the block', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    await page.getByRole('button', { name: /add new item/i }).first().click();
    await page.locator('#item-type').fill('note');
    await expect(page.locator('#item-form-modal .weapon-properties')).toBeHidden();
    await page.locator('#item-type').fill('weapon');
    await expect(page.locator('#item-form-modal .weapon-properties')).toBeVisible();
  });

  test('Cancel button closes the item form', async ({ page }) => {
    await openSheetRail(page);
    await selectCharacter(page);
    await page.locator('[data-tab="items"]').click();
    await page.getByRole('button', { name: /add new item/i }).first().click();
    const modal = page.locator('#item-form-modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /cancel/i }).click();
    await expect(modal).toHaveCount(0);
  });
});
