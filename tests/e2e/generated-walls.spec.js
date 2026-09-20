/**
 * Walls derived from a generated layout: an explicit GM action on a
 * saved map, re-runnable, and cheap enough to be worth offering.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function giveMapAGeneratedLayout(page, seed = 'wall01') {
  await page.evaluate(async (s) => {
    const sm = window.matrixVTTClient.state;
    const m = sm.maps.get('playwright-map');
    await sm.updateMap('playwright-map', {
      ...m,
      background: { kind: 'generated', generator: 'dungeon', seed: s, palette: 'dungeon', style: 'lines' },
    });
  }, seed);
}

async function openMapForm(page) {
  await page.evaluate(() => window.matrixVTTClient.ui.openMapsPanel());
  await expect(page.locator('#map-form')).toBeVisible();
}

test.describe('walls from a generated layout', () => {
  test('the action appears only for a generated background', async ({ page }) => {
    await waitForVttReady(page);
    await openMapForm(page);
    await expect(page.locator('[data-generate-walls]')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await giveMapAGeneratedLayout(page);
    await openMapForm(page);
    await expect(page.locator('[data-generate-walls]')).toBeVisible();
  });

  test('adds walls for the layout, and rerolling replaces rather than doubles them', async ({ page }) => {
    await waitForVttReady(page);
    await giveMapAGeneratedLayout(page);
    await openMapForm(page);

    await page.locator('[data-generate-walls]').click();
    await page.waitForFunction(() => window.matrixVTTClient.state.walls.size > 0);
    const first = await page.evaluate(() => window.matrixVTTClient.state.walls.size);
    expect(first).toBeGreaterThan(4);
    expect(first).toBeLessThan(200);

    const sample = await page.evaluate(() => [...window.matrixVTTClient.state.walls.values()][0]);
    expect(sample).toMatchObject({ map_id: 'playwright-map', source: 'generated', blocks_sight: true });

    await page.locator('[data-generate-walls]').click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.matrixVTTClient.state.walls.size)).toBe(first);
  });

  test('keeps walls the GM drew by hand', async ({ page }) => {
    await waitForVttReady(page);
    await giveMapAGeneratedLayout(page);
    await page.evaluate(() => window.matrixVTTClient.state.addWall({
      id: 'w-hand', map_id: 'playwright-map', p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, blocks_sight: true,
    }));
    await openMapForm(page);
    await page.locator('[data-generate-walls]').click();
    await page.waitForFunction(() => window.matrixVTTClient.state.walls.size > 1);
    expect(await page.evaluate(() => !!window.matrixVTTClient.state.walls.get('w-hand'))).toBe(true);
  });
});
