/**
 * Accessibility settings inside the Settings modal - theme picker
 * (auto/dark/light/high-contrast), reduced-motion, high-contrast.
 * The controls live in the Appearance section of the settings rail,
 * so every test navigates there after opening the modal.
 */
import { test, expect, openSettings } from './fixtures/logged-in.js';

async function openAppearanceSection(page) {
  await openSettings(page);
  await page.locator('#settings-tab-appearance').click();
}

test.describe('accessibility panel', () => {
  test('settings modal includes an Accessibility section', async ({ page }) => {
    await openAppearanceSection(page);
    await expect(page.getByText(/accessibility/i).first()).toBeVisible();
  });

  test('theme picker is a select with auto / dark / light / high-contrast options', async ({ page }) => {
    await openAppearanceSection(page);
    const select = page.locator('#acc-theme');
    await expect(select).toBeVisible();
    const values = await select.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    expect(values).toEqual(expect.arrayContaining(['auto', 'dark', 'light', 'high-contrast']));
  });

  test('selecting dark theme writes to vtt:accessibility and applies data-theme', async ({ page }) => {
    await openAppearanceSection(page);
    await page.locator('#acc-theme').selectOption('dark');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vtt:accessibility') || '{}'));
    expect(stored.theme).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('reduced-motion checkbox is present', async ({ page }) => {
    await openAppearanceSection(page);
    await expect(page.locator('#acc-reduced-motion')).toBeVisible();
  });

  test('high contrast is a theme option, not a separate checkbox', async ({ page }) => {
    await openAppearanceSection(page);
    await expect(page.locator('#acc-high-contrast')).toHaveCount(0);
    await page.locator('#acc-theme').selectOption('high-contrast');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  });
});
