/**
 * Player's Almanac shell - browser proof of the three-column layout that
 * happy-dom unit tests can't cover (real CSS, real boot, tab swapping).
 *
 * Covers the left index (sections + seeded rows + routing), the right
 * companion (tabs swap body content), and the composer. Deliberately avoids
 * the map region / initiative overlay - the fake-matrix-client has a known
 * effect-loop on live map state - and chat-reload persistence
 * is proven separately at the store layer (matrixClientStorePersistence).
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

// The almanac's three columns are a desktop layout; on mobile the shell
// collapses to one pane via the bottom tab bar (left index is CSS-hidden).
test.skip(({ isMobile }) => isMobile, 'desktop three-column layout');

test.describe('almanac shell', () => {
  test('renders the three columns: left index, right companion, composer', async ({ page }) => {
    await waitForVttShell(page);

    const leftIndex = page.locator('.left-index');
    await expect(leftIndex).toBeVisible();
    // The left index is the story index (scenes + journal). NPCs/Items are
    // right-rail tabs; Maps lives in the GlobalMenu - see LeftIndex.jsx.
    for (const section of ['scenes', 'journal']) {
      await expect(leftIndex.locator(`[data-section="${section}"]`)).toBeVisible();
    }
    for (const section of ['npcs', 'items', 'maps']) {
      await expect(leftIndex.locator(`[data-section="${section}"]`)).toHaveCount(0);
    }

    await expect(page.locator('.right-companion .ctabs').first()).toBeVisible();
    await expect(page.locator('.dice-bar')).toBeVisible(); // the composer
  });

  test('arrow keys move along the companion tabs', async ({ page }) => {
    await waitForVttShell(page);
    const strip = page.locator('.right-companion .ctabs').first();

    // The strip's own selection is not the assertion: the Sheet head is
    // a group opener that deliberately reports aria-selected=false while
    // a sub-tab owns the selection. What arrow keys must do is move.
    const start = strip.locator('[role="tab"][tabindex="0"]');
    const before = await start.getAttribute('data-tab');
    await start.focus();
    await page.keyboard.press('ArrowRight');

    const focused = strip.locator('[role="tab"]:focus');
    await expect(focused).toHaveCount(1);
    expect(await focused.getAttribute('data-tab')).not.toBe(before);
  });

  test('F hides both rails and shows them again', async ({ page }) => {
    await waitForVttShell(page);
    await expect(page.locator('.left-index')).toBeVisible();
    await expect(page.locator('.right-companion')).toBeVisible();

    // Away from the composer, which swallows plain letters by design.
    await page.locator('.left-index').click();
    await page.keyboard.press('f');
    await expect(page.locator('.left-index')).toBeHidden();
    await expect(page.locator('.right-companion')).toBeHidden();
    await expect(page.locator('.map-strip')).toBeVisible();

    await page.keyboard.press('f');
    await expect(page.locator('.left-index')).toBeVisible();
    await expect(page.locator('.right-companion')).toBeVisible();
  });

  test('the companion width survives a reload', async ({ page }) => {
    await waitForVttShell(page);
    const handle = page.locator('.right-companion__resize');
    await expect(handle).toBeVisible();

    // Keyboard rather than a synthetic drag: the same commit path, and
    // it proves the handle is reachable without a pointer.
    await handle.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    const widened = await page.locator('.shell').getAttribute('style');

    await page.reload();
    await waitForVttShell(page);
    expect(await page.locator('.shell').getAttribute('style')).toBe(widened);
  });

  test('right companion swaps body content when tabs are clicked', async ({ page }) => {
    await waitForVttShell(page);
    const companion = page.locator('.right-companion');

    // Sheet tab → character sheet body. The family head and the sub-nav
    // row both carry data-tab="sheet"; the head is the top-level one.
    const sheetHead = companion.locator('.ctabs:not(.ctabs--sub) .ctab[data-tab="sheet"]');
    await sheetHead.click();
    await expect(companion.locator('.cbody')).toBeVisible();
    await expect(sheetHead).toHaveClass(/\bon\b/);

    // Party tab → roster body (shows the seeded PC + NPC).
    await companion.locator('.ctab[data-tab="party"]').click();
    await expect(companion.locator('.ctab[data-tab="party"]')).toHaveClass(/\bon\b/);
    await expect(companion.locator('.cbody')).toContainText('Aria Blackwood');
  });

  test('the NPCs tab lists and opens a seeded NPC in the companion', async ({ page }) => {
    await waitForVttShell(page);
    const companion = page.locator('.right-companion');

    // NPCs are managed in the right-rail tab (no longer duplicated in the
    // left index). Open the tab, then click the seeded NPC.
    await companion.locator('.ctab[data-tab="npc"]').click();
    await expect(companion.locator('.ctab[data-tab="npc"]')).toHaveClass(/\bon\b/);
    await page.locator('[data-npc-card="npc-orc"]').click();
    await expect(companion.locator('.cbody')).toContainText('Orc War Boss');
  });
});
