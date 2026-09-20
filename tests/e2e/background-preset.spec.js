/**
 * Built-in map backgrounds: a GM can give a map a real background by
 * picking a bundled terrain tile, with no media upload at all. The
 * whole point of the descriptor is that the map carries a few bytes
 * rather than an image, so this asserts both the saved state and the
 * absence of an upload.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function openMapsPanel(page) {
  await page.evaluate(() => window.matrixVTTClient.ui.openMapsPanel());
  await expect(page.locator('#map-form')).toBeVisible();
}

test.describe('built-in map backgrounds', () => {
  test('the tile manifest and every tile it lists are actually served', async ({ request }) => {
    const res = await request.get('backgrounds/index.json');
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.tiles.length).toBeGreaterThan(0);

    for (const tile of manifest.tiles) {
      const img = await request.get(`backgrounds/tiles/${tile.file}`);
      expect(img.status(), tile.id).toBe(200);
      expect(img.headers()['content-type'], tile.id).toContain('image/webp');
    }
  });

  test('picking a tile saves a descriptor and uploads nothing', async ({ page }) => {
    await waitForVttReady(page);
    await openMapsPanel(page);

    await page.selectOption('#map-source-type', 'background');
    await page.locator('#map-background-group button').click();

    const picker = page.locator('#background-picker-modal');
    await expect(picker).toBeVisible();
    await picker.locator('[data-tile-id="cobble"]').click();
    await expect(picker).toHaveCount(0);

    await expect(page.locator('.map-background-summary')).toContainText('cobble');
    await page.locator('#map-form button[type="submit"]').click();

    await page.waitForFunction(() =>
      window.matrixVTTClient.state.maps.get('playwright-map')?.background?.kind === 'tile');

    const saved = await page.evaluate(() =>
      window.matrixVTTClient.state.maps.get('playwright-map').background);
    expect(saved).toEqual({ kind: 'tile', tile: 'cobble', scale: 1 });

    const uploads = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => /upload|media/i.test(e.type || '')));
    expect(uploads).toEqual([]);
  });

  // An aspect-ratio'd swatch in an auto-height grid row resolved
  // circularly and pushed the label outside the clipped tile box.
  test('every tile shows its name inside its own box', async ({ page }) => {
    await waitForVttReady(page);
    await openMapsPanel(page);
    await page.selectOption('#map-source-type', 'background');
    await page.locator('#map-background-group button').click();
    await page.locator('#background-picker-modal [data-tile-id="cobble"]').waitFor();

    const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-tile-id]')]
      .filter((tile) => {
        const label = tile.querySelector('.bg-picker__label');
        if (!label || !label.textContent.trim()) return true;
        return label.getBoundingClientRect().bottom > tile.getBoundingClientRect().bottom + 1;
      })
      .map((t) => t.dataset.tileId));
    expect(clipped).toEqual([]);
  });

  test('the picker credits the source of a tile it offers', async ({ page }) => {
    await waitForVttReady(page);
    await openMapsPanel(page);
    await page.selectOption('#map-source-type', 'background');
    await page.locator('#map-background-group button').click();

    const picker = page.locator('#background-picker-modal');
    await picker.locator('[data-tile-id="cobble"]').hover();
    await expect(picker.locator('.bg-picker__credit')).toContainText('ambientCG');
    await expect(picker.locator('.bg-picker__attribution')).toContainText('CC0');
  });
});

test.describe('generated map backgrounds', () => {
  async function openGenerate(page) {
    await waitForVttReady(page);
    await openMapsPanel(page);
    await page.selectOption('#map-source-type', 'background');
    await page.locator('#map-background-group button').click();
    await page.locator('[data-tab="generate"]').click();
    await expect(page.locator('#bg-seed')).toBeVisible();
  }

  test('generating a layout saves a seed, not an image, and uploads nothing', async ({ page }) => {
    await openGenerate(page);
    await page.fill('#bg-seed', 'crypt01');
    await page.selectOption('#bg-generator', 'dungeon');
    await page.selectOption('#bg-palette', 'crypt');
    await page.getByRole('button', { name: 'Use this map' }).click();
    await expect(page.locator('#background-picker-modal')).toHaveCount(0);

    await page.locator('#map-form button[type="submit"]').click();
    await page.waitForFunction(() =>
      window.matrixVTTClient.state.maps.get('playwright-map')?.background?.kind === 'generated');

    const saved = await page.evaluate(() =>
      window.matrixVTTClient.state.maps.get('playwright-map').background);
    expect(saved).toMatchObject({ generator: 'dungeon', seed: 'crypt01', palette: 'crypt', style: 'textured' });

    // The point of the whole descriptor: a real background costs a
    // couple of hundred bytes of room state instead of a megabyte
    // of upload.
    expect(JSON.stringify(saved).length).toBeLessThan(400);
    const uploads = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => /upload|media/i.test(e.type || '')));
    expect(uploads).toEqual([]);
  });

  test('the same seed paints the identical canvas, which is what lets clients agree', async ({ page }) => {
    await openGenerate(page);
    // Plain style so nothing depends on when a tile finishes decoding.
    await page.getByRole('button', { name: 'Plain' }).click();
    const preview = () => page.evaluate(() =>
      document.querySelector('.bg-picker__preview canvas').toDataURL());

    await page.fill('#bg-seed', 'same01');
    await page.waitForTimeout(300);
    const first = await preview();

    await page.fill('#bg-seed', 'other1');
    await page.waitForTimeout(300);
    const other = await preview();

    await page.fill('#bg-seed', 'same01');
    await page.waitForTimeout(300);
    const again = await preview();

    expect(first).toBe(again);
    expect(first).not.toBe(other);
  });

  test('the plain style needs no tile downloads at all', async ({ page }) => {
    const tileRequests = [];
    page.on('request', (r) => { if (r.url().includes('/backgrounds/tiles/')) tileRequests.push(r.url()); });
    await openGenerate(page);
    tileRequests.length = 0;
    await page.getByRole('button', { name: 'Plain' }).click();
    await page.waitForTimeout(600);
    expect(tileRequests).toEqual([]);
  });

  test('a seed that could never be painted is refused before it is saved', async ({ page }) => {
    await openGenerate(page);
    await page.fill('#bg-seed', 'not a seed!');
    await page.getByRole('button', { name: 'Use this map' }).click();
    await expect(page.locator('.bg-picker__seed-error')).toBeVisible();
    await expect(page.locator('#background-picker-modal')).toBeVisible();
  });
});
