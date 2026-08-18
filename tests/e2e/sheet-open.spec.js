/**
 * Character / NPC sheet open flow.
 *
 * Clicking a character or NPC card selects the entity straight into the
 * canonical sidebar sheet - there is no intermediate preview popup for
 * cards (the preview modal is reserved for inline glances like wikilinks;
 * see preview-modal.spec.js). Edit is available on the sheet header.
 *
 * Specs avoid the destroy/leave path (headless-Konva quirk).
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';
import AxeBuilder from '@axe-core/playwright';

const BLOCKING = new Set(['critical', 'serious', 'moderate']);

// Switch to a tab via the visible tab button (data-tab="<tab-name>").
async function switchToTab(page, tabName) {
  await page.locator(`[data-tab="${tabName}"]`).click();
}

test.describe('character sheet open flow', () => {
  test('clicking a character card opens the sidebar sheet with no popup', async ({ page }) => {
    await openSheetRail(page);
    const card = page.locator('[data-character-card="chr-aria"]');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page.locator('.char-sheet[data-entity-id="chr-aria"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });

  test('Edit on the sheet opens the entity-form modal with the name pre-filled', async ({ page }) => {
    await openSheetRail(page);
    await page.locator('[data-character-card="chr-aria"]').click();
    await expect(page.locator('.char-sheet[data-entity-id="chr-aria"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('.char-sheet').getByRole('button', { name: /edit character/i }).click();
    await expect(page.locator('#entity-form-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#entity-name')).toHaveValue('Aria Blackwood');
  });

  test('the opened sheet passes axe-core blocking rules', async ({ page }) => {
    await openSheetRail(page);
    await page.locator('[data-character-card="chr-aria"]').click();
    await expect(page.locator('.char-sheet[data-entity-id="chr-aria"]')).toBeVisible({ timeout: 5_000 });
    const results = await new AxeBuilder({ page })
      .include('.char-sheet')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    expect(
      blocking,
      `sheet axe violations:\n${blocking.map((v) => `  ${v.id} (${v.impact}): ${v.help}`).join('\n')}`,
    ).toEqual([]);
  });
});

test.describe('NPC sheet open flow', () => {
  test('clicking an NPC card opens the sidebar NPC sheet with no popup', async ({ page }) => {
    await openSheetRail(page);
    await switchToTab(page, 'npc');
    const npcCard = page.locator('[data-npc-card="npc-orc"]');
    await expect(npcCard).toBeVisible({ timeout: 10_000 });
    await npcCard.click();
    await expect(page.locator('[data-entity-id="npc-orc"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });
});
