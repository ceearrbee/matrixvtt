/**
 * Map surface: the seeded map renders a Konva canvas, seeded tokens
 * hydrate from the Yjs snapshot, and keyboard movement (select, M,
 * arrows, Enter - documented in the map help) moves the token and
 * broadcasts the move as a com.matrixvtt.yjs.update timeline event
 * through the fake client.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

/**
 * Select a token through the renderer's public selection API. Konva
 * token groups carry no DOM-queryable id, so a synthetic mouse click
 * would need viewport-dependent coordinate math; the spec under test
 * is the keyboard movement path, not hit-testing. Also blurs any
 * focused form field, since the keyboard handler ignores keydowns
 * while an input has focus.
 */
async function selectToken(page, tokenId) {
  await page.waitForFunction(
    (id) => !!window.matrixVTTClient?.ui?.mapRenderer?.stage && !!window.matrixVTTClient.ui.mapRenderer.state.tokens.get(id),
    tokenId,
  );
  await page.evaluate((id) => {
    const el = document.activeElement;
    if (el && typeof el.blur === 'function') el.blur();
    window.matrixVTTClient.ui.mapRenderer.setSelectedToken(id);
  }, tokenId);
}

test.describe('map and tokens', () => {
  test('seeded map renders a visible Konva canvas', async ({ page }) => {
    await waitForVttReady(page);
    await expect(page.locator('#map-canvas canvas').first()).toBeVisible();
    // The empty-map placeholder must not show when a map is seeded.
    await expect(page.locator('.map-empty')).toHaveCount(0);
  });

  test('seeded tokens hydrate into runtime state', async ({ page }) => {
    await waitForVttReady(page);
    const tokens = await page.evaluate(() => {
      const sm = window.matrixVTTClient.state;
      return {
        aria: sm.tokens.get('tok-aria'),
        orc: sm.tokens.get('tok-orc'),
      };
    });
    expect(tokens.aria).toMatchObject({ col: 5, row: 5, map_id: 'playwright-map' });
    expect(tokens.orc).toMatchObject({ col: 8, row: 5 });
  });

  test('keyboard movement mode moves the selected token and broadcasts it', async ({ page }) => {
    await waitForVttReady(page);
    await selectToken(page, 'tok-aria');
    await page.waitForFunction(() => window.matrixVTTClient.ui.mapRenderer.selectedToken === 'tok-aria');

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => {
      const t = window.matrixVTTClient.state.tokens.get('tok-aria');
      return t.col === 6 && t.row === 6;
    });

    // The move must go out over the wire: the Yjs transport coalesces
    // local doc updates (300ms) into com.matrixvtt.yjs.update timeline
    // events sent through the fake client.
    await page.waitForFunction(() => (window.__VTT_E2E_SENT_EVENTS || [])
      .some((e) => e.type === 'com.matrixvtt.yjs.update'));
  });

  test('Escape cancels movement mode and restores the origin cell', async ({ page }) => {
    await waitForVttReady(page);
    await selectToken(page, 'tok-aria');
    await page.waitForFunction(() => window.matrixVTTClient.ui.mapRenderer.selectedToken === 'tok-aria');

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(
      () => window.matrixVTTClient.state.tokens.get('tok-aria').col === 4,
    );
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const t = window.matrixVTTClient.state.tokens.get('tok-aria');
      return t.col === 5 && t.row === 5;
    });
  });
});
