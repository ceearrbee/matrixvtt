/**
 * axe-core over the regions the original four scans never reached:
 * the chronicle column, the left index, the right companion rail, and
 * the big modals. Every scan, these and the original four alike,
 * blocks on moderate and above.
 */
import { test, expect, waitForVttShell, openSheetRail } from './fixtures/logged-in.js';
import AxeBuilder from '@axe-core/playwright';

const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious', 'moderate']);

async function expectClean(page, include, label) {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withTags(A11Y_TAGS)
    .analyze();
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
  expect(
    blocking,
    `${label} axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}`).join('\n')}`,
  ).toEqual([]);
}

test.describe('axe: play-surface regions', () => {
  test('chronicle column (log + composer + dice bar)', async ({ page }) => {
    await waitForVttShell(page);
    await expect(page.locator('.chronicle')).toBeVisible();
    await expectClean(page, '.chronicle', 'chronicle');
  });

  test('left index', async ({ page }) => {
    await waitForVttShell(page);
    await expectClean(page, '.shell__channels', 'left index');
  });

  test('right companion rail', async ({ page }) => {
    await openSheetRail(page);
    await expectClean(page, '#shell-sheet-drawer', 'right companion');
  });

  test('map region and drawing toolbar', async ({ page }) => {
    await waitForVttShell(page);
    await expect(page.locator('.draw-toolbar')).toBeVisible();
    await expectClean(page, '.map-strip, .draw-toolbar', 'map region');
  });

  test('command palette', async ({ page }) => {
    await waitForVttShell(page);
    await page.keyboard.press('/');
    await expect(page.locator('#cp-input')).toBeVisible();
    await expectClean(page, '#command-palette-modal, [role="dialog"]', 'command palette');
  });
});
