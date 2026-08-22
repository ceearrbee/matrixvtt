/**
 * Invite link end to end: opening app.html?join=... announces the
 * invite, survives sign-in, and lands the player in the room preview
 * without them touching the join field. The URL is stripped so a
 * reload does not fire the invite again.
 */
import { test, expect } from './fixtures/fresh-visitor.js';

const ROOM = '!someroom:fake.matrix.test';
const JOIN_URL = `app.html?join=${encodeURIComponent(ROOM)}&via=fake.matrix.test`;

test.describe('invite link', () => {
  test('carries a signed-out player through login into the room preview', async ({ page }) => {
    await page.goto(JOIN_URL);
    await expect(page.locator('#invite-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/app\.html$/);
    await expect(page.locator('#show-register-btn')).toBeVisible();

    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');

    const modal = page.locator('#room-preview-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.locator('[data-confirm]').click();
    await expect(page.locator('#screen-vtt')).toBeVisible({ timeout: 15_000 });
  });

  test('is consumed once, so a plain visit goes to discovery', async ({ page }) => {
    await page.goto(JOIN_URL);
    await expect(page.locator('#invite-banner')).toBeVisible({ timeout: 15_000 });

    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');
    const modal = page.locator('#room-preview-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.locator('[data-cancel]').click();

    await page.reload();
    await expect(page.locator('#new-session-input')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#room-preview-modal')).toHaveCount(0);
  });

  test('ignores a junk target and shows the plain login screen', async ({ page }) => {
    await page.goto('app.html?join=nonsense');
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#invite-banner')).toHaveCount(0);
  });
});
