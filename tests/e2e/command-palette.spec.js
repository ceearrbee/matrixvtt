/**
 * The palette is the way in. It could not be opened in normal use:
 * `/` sits inside the typing guard and the chat composer is a textarea
 * holding the shell's resting focus, so the one documented entry point
 * was blocked exactly where a user spends their time.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

const PALETTE = '#command-palette';

test.describe('command palette', () => {
  test('opens with Ctrl+K while the chat composer has focus', async ({ page }) => {
    await waitForVttReady(page);
    await page.locator('#chat-input').click();
    await expect(page.locator('#chat-input')).toBeFocused();

    await page.keyboard.press('Control+k');
    await expect(page.locator(PALETTE)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#cp-input')).toBeFocused();
  });

  test('finds a map, which it could not index at all before', async ({ page }) => {
    await waitForVttReady(page);
    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('Playwright');
    await expect(page.locator('.cp-row').first()).toBeVisible();
    await expect(page.locator('.cp-results')).toContainText(/map/i);
  });

  test('runs a command instead of only finding a noun', async ({ page }) => {
    await waitForVttReady(page);
    await page.keyboard.press('Control+k');
    await page.locator('#cp-input').fill('fog');

    const row = page.locator('.cp-row', { hasText: /fog/i }).first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.locator(PALETTE)).toHaveCount(0);
    await page.waitForFunction(
      () => window.matrixVTTClient.state.fog.mode !== 'hidden',
      null,
      { timeout: 10_000 },
    );
  });

  test('tells the user it exists, from the composer they are already looking at', async ({ page }) => {
    await waitForVttReady(page);
    await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', /Ctrl\+K/);
  });
});
