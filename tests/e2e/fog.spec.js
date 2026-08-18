/**
 * Fog of war: the GM toggles fog on/off, reveals or hides the whole
 * map, and each change lands in runtime state, on the Konva fog layer
 * (the piece that actually hides map area from players), and on the
 * wire as a com.matrixvtt.yjs.update timeline event through the fake
 * client.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function openFogPanel(page) {
  await page.locator('#gm-controls-btn').click();
  await page.locator('[data-gm-subnav-id="fog"]').click();
  await expect(page.locator('.gm-panel--fog')).toBeVisible();
}

function fogLayerVisible(page) {
  return page.evaluate(() =>
    window.matrixVTTClient.ui.mapRenderer.stage.findOne('.fog').getLayer().visible());
}

test.describe('fog of war', () => {
  test('fog is on by default and hides the map', async ({ page }) => {
    await waitForVttReady(page);
    const fog = await page.evaluate(() => window.matrixVTTClient.state.fog);
    expect(fog.mode).toBe('hidden');
    expect(await fogLayerVisible(page)).toBe(true);
  });

  test('GM turning fog off reveals the map and broadcasts the change', async ({ page }) => {
    await waitForVttReady(page);
    await openFogPanel(page);
    await page.getByRole('button', { name: /Turn off fog of war/ }).click();

    await page.waitForFunction(() => window.matrixVTTClient.state.fog.mode === 'visible');
    expect(await fogLayerVisible(page)).toBe(false);

    await page.waitForFunction(() => (window.__VTT_E2E_SENT_EVENTS || [])
      .some((e) => e.type === 'com.matrixvtt.yjs.update'));
  });

  test('GM turning fog back on hides the map again', async ({ page }) => {
    await waitForVttReady(page);
    await openFogPanel(page);
    await page.getByRole('button', { name: /Turn off fog of war/ }).click();
    await page.waitForFunction(() => window.matrixVTTClient.state.fog.mode === 'visible');

    await page.getByRole('button', { name: /Turn on fog of war/ }).click();
    await page.waitForFunction(() => window.matrixVTTClient.state.fog.mode === 'hidden');
    expect(await fogLayerVisible(page)).toBe(true);
  });

  test('Reveal All marks every map cell revealed', async ({ page }) => {
    await waitForVttReady(page);
    await openFogPanel(page);
    await page.getByRole('button', { name: 'Reveal entire map to players' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reveal All', exact: true }).click();

    await page.waitForFunction(() => window.matrixVTTClient.state.fog.revealed.length === 20 * 20);
    const fog = await page.evaluate(() => window.matrixVTTClient.state.fog);
    expect(fog.mode).toBe('hidden');
  });

  test('Hide All clears revealed cells', async ({ page }) => {
    await waitForVttReady(page);
    await openFogPanel(page);
    await page.getByRole('button', { name: 'Reveal entire map to players' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reveal All', exact: true }).click();
    await page.waitForFunction(() => window.matrixVTTClient.state.fog.revealed.length === 20 * 20);

    await page.getByRole('button', { name: 'Hide entire map with fog' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hide All', exact: true }).click();

    await page.waitForFunction(() => window.matrixVTTClient.state.fog.revealed.length === 0);
  });
});
