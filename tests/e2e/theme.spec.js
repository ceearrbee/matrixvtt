/**
 * Theme persistence: the inline preload in app.html must read the same
 * storage key the runtime saves to (`vtt:accessibility.theme`), or a
 * saved preference is silently lost on reload.
 *
 * These specs don't need a logged-in shell; they only exercise the
 * inline preload + the CSS data-theme switch.
 */
import { test, expect } from '@playwright/test';

test.describe('theme persistence', () => {
  test('inline preload reads vtt:accessibility and applies data-theme before paint', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'vtt:accessibility',
        JSON.stringify({ theme: 'dark', reduced_motion: false, high_contrast: false }),
      );
    });
    await page.goto('app.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('theme=light is honored the same way', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'vtt:accessibility',
        JSON.stringify({ theme: 'light', reduced_motion: false, high_contrast: false }),
      );
    });
    await page.goto('app.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme=auto leaves data-theme unset so prefers-color-scheme drives', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'vtt:accessibility',
        JSON.stringify({ theme: 'auto', reduced_motion: false, high_contrast: false }),
      );
    });
    await page.goto('app.html');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  });
});
