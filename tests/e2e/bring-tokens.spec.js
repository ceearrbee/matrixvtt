/**
 * Placing tokens on the map you are looking at, and the selection not
 * following you to it.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function secondMap(page) {
  return page.evaluate(async () => {
    const sm = window.matrixVTTClient.state;
    const id = await sm.createMap({
      name: 'Deeper', width_cells: 16, height_cells: 12, cell_px: 50,
      image_url: null, background: null, layers: [],
    });
    return id;
  });
}

test.describe('placing tokens on another map', () => {
  test('a marquee selection does not follow the GM to the next map', async ({ page }) => {
    await waitForVttReady(page);
    await page.evaluate(() => {
      const mr = window.matrixVTTClient.ui.mapRenderer;
      mr.setSelectedTokens(['tok-aria', 'tok-orc']);
    });
    expect(await page.evaluate(() => window.matrixVTTClient.ui.mapRenderer.selectedTokenIds.size)).toBe(2);

    await secondMap(page);
    await page.waitForFunction(() => window.matrixVTTClient.state.activeMapId !== 'playwright-map');
    expect(await page.evaluate(() => window.matrixVTTClient.ui.mapRenderer.selectedTokenIds.size)).toBe(0);
  });

  test('tokens from the old map can be placed on the new one', async ({ page }) => {
    await waitForVttReady(page);
    const mapId = await secondMap(page);
    await page.waitForFunction((id) => window.matrixVTTClient.state.activeMapId === id, mapId);

    // Nothing is on the new map yet.
    expect(await page.evaluate((id) => [...window.matrixVTTClient.state.tokens.values()]
      .filter((t) => t.map_id === id).length, mapId)).toBe(0);

    await page.evaluate(() => window.matrixVTTClient.ui.showBringTokens(4, 3));
    await expect(page.locator('#bring-tokens-modal')).toBeVisible();
    await expect(page.locator('[data-bring-token]').first()).toBeVisible();

    await page.locator('[data-bring-token="tok-aria"] input').check();
    await page.getByRole('button', { name: /^Place 1$/ }).click();
    await expect(page.locator('#bring-tokens-modal')).toHaveCount(0);

    const placed = await page.evaluate(() => window.matrixVTTClient.state.tokens.get('tok-aria'));
    expect(placed.map_id).toBe(mapId);
    expect(placed).toMatchObject({ col: 4, row: 3 });
  });

  test('the whole party moves in one go, without stacking', async ({ page }) => {
    await waitForVttReady(page);
    const mapId = await secondMap(page);
    await page.waitForFunction((id) => window.matrixVTTClient.state.activeMapId === id, mapId);

    await page.evaluate(() => window.matrixVTTClient.ui.showBringTokens(5, 5));
    await page.locator('[data-bring-token]').first().waitFor();
    const partyButton = page.getByRole('button', { name: 'Select the party' });
    if (await partyButton.count()) {
      await partyButton.click();
      await page.getByRole('button', { name: /^Place \d+$/ }).click();
      await expect(page.locator('#bring-tokens-modal')).toHaveCount(0);

      const cells = await page.evaluate((id) => [...window.matrixVTTClient.state.tokens.values()]
        .filter((t) => t.map_id === id).map((t) => `${t.col},${t.row}`), mapId);
      expect(cells.length).toBeGreaterThan(0);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

});
