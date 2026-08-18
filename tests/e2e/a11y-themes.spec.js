/**
 * Full-page axe per theme. The original scans only ever saw the Dark
 * default; Light, High Contrast, and Nondescript were shipped blind.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';
import AxeBuilder from '@axe-core/playwright';

const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious', 'moderate']);

for (const theme of ['light', 'high-contrast', 'nondescript']) {
  test(`full page passes axe in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem('vtt:accessibility', JSON.stringify({ theme: t }));
    }, theme);
    await waitForVttShell(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const results = await new AxeBuilder({ page })
      .withTags(A11Y_TAGS)
      .analyze();
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    expect(
      blocking,
      `${theme} axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ')}`).join('\n')}`,
    ).toEqual([]);
  });
}
