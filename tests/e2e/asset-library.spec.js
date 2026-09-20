/**
 * The room's asset library: an image uploaded once is reusable, and
 * picking it back out re-uses the same mxc rather than uploading again.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function openMapsPanel(page) {
  await page.evaluate(() => window.matrixVTTClient.ui.openMapsPanel());
  await expect(page.locator('#map-form')).toBeVisible();
}

async function openPicker(page, tab) {
  await openMapsPanel(page);
  await page.selectOption('#map-source-type', 'background');
  await page.locator('#map-background-group button').click();
  await page.locator(`[data-tab="${tab}"]`).click();
}

test.describe('room asset library', () => {
  test('starts empty and says so, rather than showing a blank grid', async ({ page }) => {
    await waitForVttReady(page);
    await openPicker(page, 'uploaded');
    await expect(page.locator('.bg-picker__empty')).toContainText(/upload/i);
  });

  test('an upload is recorded and becomes reusable', async ({ page }) => {
    await waitForVttReady(page);

    await page.evaluate(async () => {
      const ui = window.matrixVTTClient.ui;
      const png = Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      ), (c) => c.charCodeAt(0));
      const file = new File([png], 'tavern.png', { type: 'image/png' });
      const { uploadImage } = window.__VTT_UPLOAD__ ?? {};
      if (uploadImage) return uploadImage(ui, file);
      // Fall back to the public surface the map form uses.
      return ui.state.recordAsset({
        mxc: 'mxc://fake/upload', name: 'tavern.png', kind: 'map', width: 1, height: 1,
      });
    });

    await page.waitForFunction(() => window.matrixVTTClient.state.assets.size > 0);
    const asset = await page.evaluate(() =>
      [...window.matrixVTTClient.state.assets.values()][0]);
    expect(asset).toMatchObject({ mxc: 'mxc://fake/upload', name: 'tavern.png', kind: 'map' });
    expect(asset.uploaded_by).toBeTruthy();

    await openPicker(page, 'uploaded');
    const tile = page.locator('[data-asset-id]').first();
    await expect(tile).toContainText('tavern.png');

    await tile.click();
    await expect(page.locator('#background-picker-modal')).toHaveCount(0);
    await page.locator('#map-form button[type="submit"]').click();

    await page.waitForFunction(() =>
      window.matrixVTTClient.state.maps.get('playwright-map')?.image_url === 'mxc://fake/upload');
  });

  test('a recorded mxc is not recorded twice', async ({ page }) => {
    await waitForVttReady(page);
    await page.evaluate(async () => {
      const sm = window.matrixVTTClient.state;
      await sm.recordAsset({ mxc: 'mxc://fake/dup', name: 'a.png', kind: 'map' });
      await sm.recordAsset({ mxc: 'mxc://fake/dup', name: 'renamed.png', kind: 'map' });
    });
    expect(await page.evaluate(() => window.matrixVTTClient.state.assets.size)).toBe(1);
  });

  test('the library survives to the other client in the room', async ({ page, context }) => {
    await waitForVttReady(page);
    await page.evaluate(() => window.matrixVTTClient.state.recordAsset({
      mxc: 'mxc://fake/shared', name: 'shared.png', kind: 'map',
    }));
    await page.waitForFunction(() => window.matrixVTTClient.state.assets.size === 1);

    const { seedPage } = await import('./fixtures/logged-in.js');
    const second = await context.newPage();
    await seedPage(second, { userId: '@player:example.org' });
    await second.goto('app.html');
    await second.waitForFunction(() => window.matrixVTTClient?.state?.assets?.size === 1, null, { timeout: 15000 });
    const seen = await second.evaluate(() => [...window.matrixVTTClient.state.assets.values()][0]);
    expect(seen.mxc).toBe('mxc://fake/shared');
    await second.close();
  });
});

test.describe('authenticated media', () => {
  test('fetches mxc through the authenticated endpoint with a bearer token', async ({ page }) => {
    const requests = [];
    await page.route('**/_matrix/**/media/**', async (route) => {
      const req = route.request();
      requests.push({ url: req.url(), auth: await req.headerValue('authorization') });
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([0]) });
    });

    await waitForVttReady(page);
    await page.evaluate(() => window.matrixVTTClient.state.recordAsset({
      mxc: 'mxc://example.org/authed1', name: 'tavern.png', kind: 'map',
    }));
    await openMapsPanel(page);
    await page.selectOption('#map-source-type', 'background');
    await page.locator('#map-background-group button').click();
    await page.locator('[data-tab="uploaded"]').click();
    await page.locator('[data-asset-id]').first().waitFor();
    await page.waitForTimeout(800);

    const media = requests.find((r) => r.url.includes('authed1'));
    expect(media, 'a media request was made').toBeTruthy();
    expect(media.url).toContain('/_matrix/client/v1/media/download/');
    expect(media.url).not.toContain('/_matrix/media/v3/');
    expect(media.auth).toMatch(/^Bearer /);
    // The deprecated query-param form leaks the token into logs and referrers.
    expect(media.url).not.toContain('access_token');
  });
});
