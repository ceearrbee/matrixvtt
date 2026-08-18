/**
 * Pre-login surface - Playwright smoke + axe-core a11y check.
 *
 * This is the standalone entry the public hits before any Matrix
 * credentials are involved. It must render, be keyboard-reachable,
 * not throw, and pass core axe checks across the browser matrix.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BLOCKING = new Set(['critical', 'serious', 'moderate']);

test.describe('auth screen', () => {
  test('renders without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto('app.html');
    // The shell mounts asynchronously after the bootstrap import resolves.
    await expect(page.locator('#vtt-shell-root')).toBeVisible();
    // Auth form is the first interactive surface for a fresh visitor.
    await expect(page.getByLabel(/homeserver/i)).toBeVisible();

    expect(errors, `unexpected console/page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('passes axe-core on the auth screen', async ({ page }) => {
    await page.goto('app.html');
    await expect(page.locator('#vtt-shell-root')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    expect(
      blocking,
      `axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}`).join('\n')}`,
    ).toEqual([]);
  });

  test('skip-nav link is the first tab stop', async ({ page }) => {
    await page.goto('app.html');
    await expect(page.locator('#vtt-shell-root')).toBeVisible();

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.className || '');
    expect(focused).toContain('skip-nav');
  });
});

test.describe('index.html widget entry', () => {
  test('top-frame visit redirects to app.html', async ({ page }) => {
    await page.goto('index.html');
    // The inline redirect script swaps location.href when not inside an iframe.
    await page.waitForURL(/\/app\.html/);
    expect(page.url()).toMatch(/app\.html/);
  });
});
