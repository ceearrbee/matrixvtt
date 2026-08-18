/**
 * Preview modal - the lightweight "peek" at an entity. Since cards now
 * open the sidebar sheet directly, the preview popup is reached inline
 * (e.g. a wikilink in a handout) or via the runtime helpers
 * ui.show{Character,NPC}Preview. These specs drive those helpers
 * directly, then verify the peek's header + footer actions and dismissal.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function openCharacterPreview(page) {
  await waitForVttReady(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showCharacterPreview('chr-aria'));
  await expect(page.locator('#preview-modal')).toBeVisible({ timeout: 5_000 });
}

async function openNPCPreview(page) {
  await waitForVttReady(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showNPCPreview('npc-orc'));
  await expect(page.locator('#preview-modal')).toBeVisible({ timeout: 5_000 });
}

test.describe('preview modal - character', () => {
  test('shows the character header with subtitle', async ({ page }) => {
    await openCharacterPreview(page);
    const modal = page.locator('#preview-modal');
    await expect(modal.locator('.preview-modal__name')).toContainText('Aria Blackwood');
    await expect(modal.locator('.preview-modal__sub')).toBeVisible();
  });

  test('shows the View Full Sheet footer button', async ({ page }) => {
    await openCharacterPreview(page);
    await expect(page.locator('#preview-modal').getByRole('button', { name: /view full sheet/i })).toBeVisible();
  });

  test('shows the Close footer button', async ({ page }) => {
    await openCharacterPreview(page);
    await expect(page.locator('#preview-modal [data-modal-close]:not(.modal-close)')).toBeVisible();
  });

  test('Escape closes the preview', async ({ page }) => {
    await openCharacterPreview(page);
    await expect(page.locator('#preview-modal .modal-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });

  test('the X header button closes the preview', async ({ page }) => {
    await openCharacterPreview(page);
    await page.locator('#preview-modal .modal-close').click();
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });

  test('the footer Close button closes the preview (event-delegation fix)', async ({ page }) => {
    await openCharacterPreview(page);
    await page.locator('#preview-modal [data-modal-close]:not(.modal-close)').click();
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });
});

test.describe('preview modal - NPC', () => {
  test('NPC preview shows the NPC name', async ({ page }) => {
    await openNPCPreview(page);
    await expect(page.locator('#preview-modal .preview-modal__name')).toHaveText('Orc War Boss');
  });

  test('NPC preview Escape dismisses', async ({ page }) => {
    await openNPCPreview(page);
    await expect(page.locator('#preview-modal .modal-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#preview-modal')).toHaveCount(0);
  });
});
