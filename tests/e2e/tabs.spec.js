/**
 * Tab-switching smoke. Each tab must render its content without
 * console errors. The right-side panel (RightCompanion.jsx) drives this.
 *
 * Tabs gated by ruleset (Spells, Skills) only mount when the active
 * systemConfig defines them. The fake's seeded settings use the
 * 'generic' system which doesn't expose spell_schools or skills, so
 * those tabs are tested in a separate spec with a dnd5e seed.
 *
 * The activity log lives in the chronicle `LogPanel` (see `log-tab.spec.js`),
 * and handouts/pages moved to the left-index Journal - neither is a
 * right-rail tab in the almanac shell.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

const ALWAYS_VISIBLE_TABS = [
  { id: 'sheet', label: /character sheet/i },
  { id: 'npc', label: /npc list/i },
  { id: 'items', label: /item list/i },
];

test.describe('tab switching', () => {
  for (const { id } of ALWAYS_VISIBLE_TABS) {
    test(`switches to the ${id} tab without console errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Konva|sonner|Failed to load resource/.test(m.text())) {
          errors.push(`console.error: ${m.text()}`);
        }
      });

      await openSheetRail(page);
      // "sheet" appears twice (family head + sub-nav row); click the first
      // and assert selection on whichever row carries it.
      const btn = page.locator(`[data-tab="${id}"]`).first();
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.click();
      await expect(page.locator(`[data-tab="${id}"][aria-selected="true"]`)).toBeVisible();
      await expect(page.locator('#companion-content')).toBeVisible();
      expect(errors, `errors switching to ${id}:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  test('tablist exposes role=tablist with all tabs as role=tab', async ({ page }) => {
    await openSheetRail(page);
    const tablist = page.locator('[role="tablist"][aria-label="Companion sections"]');
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole('tab');
    await expect(tabs).not.toHaveCount(0);
  });

  test('only one tab is aria-selected at a time', async ({ page }) => {
    await openSheetRail(page);
    // Click into Items
    await page.locator('[data-tab="items"]').click();
    const selected = page.locator('.ctab[aria-selected="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-tab', 'items');
  });

  test('keyboard activation: Enter on a focused tab switches', async ({ page }) => {
    await openSheetRail(page);
    const itemsTab = page.locator('[data-tab="items"]');
    await itemsTab.focus();
    await page.keyboard.press('Enter');
    await expect(itemsTab).toHaveAttribute('aria-selected', 'true');
  });
});
