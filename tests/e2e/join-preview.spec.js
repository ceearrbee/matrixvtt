/**
 * Player path entry: joining by room id shows the pre-join preview
 * with a working cancel, and confirming enters the room.
 */
import { test, expect, gotoLogin } from './fixtures/fresh-visitor.js';

async function loginToDiscovery(page) {
  await gotoLogin(page);
  await page.fill('#username', 'playwright');
  await page.fill('#password', 'hunter2');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#discovery-userid')).toContainText('@playwright');
}

test.describe('join by room id', () => {
  test('shows the preview modal; cancel returns to discovery', async ({ page }) => {
    await loginToDiscovery(page);
    await page.fill('#new-session-input', '!someroom:fake.matrix.test');
    await page.click('#new-session-btn');

    const modal = page.locator('#room-preview-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/confirm join/i);

    await modal.locator('[data-cancel]').click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('#new-session-input')).toBeVisible();
  });

  test('confirming enters the room', async ({ page }) => {
    await loginToDiscovery(page);
    await page.fill('#new-session-input', '!someroom:fake.matrix.test');
    await page.click('#new-session-btn');

    const modal = page.locator('#room-preview-modal');
    await expect(modal).toBeVisible();
    await modal.locator('[data-confirm]').click();

    await expect(page.locator('#screen-vtt')).toBeVisible({ timeout: 15_000 });
  });
});
