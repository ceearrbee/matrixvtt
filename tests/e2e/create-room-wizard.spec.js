/**
 * GM path: login -> discovery -> Create Room -> setup wizard -> blank
 * campaign -> live shell. Gates the deterministic wizard decision
 * (forceWizard beats the visited stamp) end to end.
 */
import { test, expect, gotoLogin } from './fixtures/fresh-visitor.js';

test.describe('create room and seed a campaign', () => {
  test('Create Room opens the wizard; blank campaign reaches the shell', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#discovery-userid')).toContainText('@playwright');

    await page.fill('#create-room-input', 'Funnel Test Campaign');
    await page.click('#create-room-btn');

    const wizard = page.locator('#setup-wizard');
    await expect(wizard).toBeVisible({ timeout: 15_000 });

    await page.fill('#campaign-name', 'Funnel Test Campaign');
    await page.getByRole('button', { name: 'Create Blank Campaign' }).click();

    await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });

    const sentSettings = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).some(
        (e) => e.type === 'com.vtt.settings' && e.content?.name === 'Funnel Test Campaign',
      ));
    expect(sentSettings).toBe(true);
  });
});
