/**
 * Handouts CRUD smoke. In the almanac shell handouts live in the left-index
 * Journal section (not a right-rail Notes tab); a GM authors one via the
 * empty-state "Add a handout" CTA, which opens the handout form modal.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

const journal = (page) => page.locator('.left-index [data-section="journal"]');
const addHandout = (page) => journal(page).getByRole('button', { name: /add a handout/i }).first();

test.describe('handouts (left-index Journal)', () => {
  test('Journal section shows the empty-state Add-a-handout CTA for GMs', async ({ page }) => {
    await waitForVttShell(page);
    await expect(journal(page)).toBeVisible();
    await expect(addHandout(page)).toBeVisible();
  });

  test('Add a handout opens the form modal', async ({ page }) => {
    await waitForVttShell(page);
    await addHandout(page).click();
    await expect(page.locator('#handout-form-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('handout form has title + content + visibility fields', async ({ page }) => {
    await waitForVttShell(page);
    await addHandout(page).click();
    const modal = page.locator('#handout-form-modal');
    await expect(modal.locator('input,textarea').first()).toBeVisible();
  });

  test('Cancel closes the handout form', async ({ page }) => {
    await waitForVttShell(page);
    await addHandout(page).click();
    const modal = page.locator('#handout-form-modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /cancel/i }).first().click();
    await expect(modal).toHaveCount(0);
  });
});
