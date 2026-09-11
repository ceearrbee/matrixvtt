/**
 * GM path: login -> discovery -> name + system -> Create Room -> setup
 * wizard -> live shell. Gates the deterministic wizard decision
 * (forceWizard beats the visited stamp) end to end, and that the wizard
 * confirms the campaign rather than asking for its name a second time.
 */
import { test, expect, gotoLogin } from './fixtures/fresh-visitor.js';

test.describe('create room and seed a campaign', () => {
  test('Create Room opens the wizard; the wizard confirms and reaches the shell', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#discovery-userid')).toContainText('@playwright');

    await page.fill('#create-room-input', 'Funnel Test Campaign');
    await page.selectOption('#create-room-system', 'fate');

    await page.click('#create-room-btn');

    const wizard = page.locator('#setup-wizard');
    await expect(wizard).toBeVisible({ timeout: 15_000 });

    // The name and system were collected at creation, so the wizard
    // reads them back instead of asking again.
    await expect(wizard.locator('#campaign-name')).toHaveCount(0);
    await expect(wizard.locator('.wizard-summary')).toContainText('Funnel Test Campaign');

    await page.getByRole('button', { name: 'Create campaign' }).click();

    await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });

    const settings = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).find(
        (e) => e.type === 'com.vtt.settings' && e.content?.name === 'Funnel Test Campaign',
      ));
    expect(settings).toBeTruthy();
    expect(settings.content.system).toBe('fate');
  });
});
