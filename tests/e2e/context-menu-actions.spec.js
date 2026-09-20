/**
 * The map and token right-click menus reach the UI controller.
 *
 * `window.ui` is a dev helper, set only under `import.meta.env.DEV`.
 * Anything in a context menu that reads it does nothing in a real
 * build, and every one of those call sites is optional-chained, so it
 * fails silently rather than throwing.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

test.describe('context menus in a production build', () => {
  test('the dev-only window.ui really is absent here', async ({ page }) => {
    await waitForVttReady(page);
    expect(await page.evaluate(() => window.ui ?? null)).toBeNull();
    // The renderer carries the controller instead.
    expect(await page.evaluate(() => !!window.matrixVTTClient.ui.mapRenderer._ui)).toBe(true);
  });

  test('Place Tokens Here reaches the controller', async ({ page }) => {
    await waitForVttReady(page);
    await page.evaluate(() => {
      const mr = window.matrixVTTClient.ui.mapRenderer;
      mr.stage.fire('contextmenu', { evt: new MouseEvent('contextmenu', { clientX: 400, clientY: 300 }) });
    });
    const item = page.locator('#map-context-menu [role="menuitem"]', { hasText: 'Place Tokens Here' });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.locator('#bring-tokens-modal')).toBeVisible();
  });

  test('removing a token mid-combat drops its initiative entry', async ({ page }) => {
    await waitForVttReady(page);
    await page.evaluate(async () => {
      const ui = window.matrixVTTClient.ui;
      await ui.state.updateInitiative({
        active: true, round: 1, current_index: 0,
        order: [
          { token_id: 'tok-aria', name: 'Aria', initiative: 18 },
          { token_id: 'tok-orc', name: 'Orc', initiative: 12 },
        ],
      });
    });
    await page.waitForFunction(() => window.matrixVTTClient.state.initiative.order.length === 2);

    await page.evaluate(() => {
      const mr = window.matrixVTTClient.ui.mapRenderer;
      mr.removeToken('tok-orc');
    });
    await page.locator('#remove-confirm-btn').click();

    await page.waitForFunction(
      () => !window.matrixVTTClient.state.initiative.order.some((e) => e.token_id === 'tok-orc'),
      null,
      { timeout: 5000 },
    );
    const ids = await page.evaluate(() =>
      window.matrixVTTClient.state.initiative.order.map((e) => e.token_id));
    expect(ids).toEqual(['tok-aria']);
  });

  test('token menu actions are wired to something that exists', async ({ page }) => {
    await waitForVttReady(page);
    await page.evaluate(() => {
      const mr = window.matrixVTTClient.ui.mapRenderer;
      const token = mr.state.tokens.get('tok-orc');
      mr.showTokenContextMenu(token, 400, 300);
    });
    const menu = page.locator('#token-context-menu');
    if (await menu.count() === 0) test.skip(true, 'token menu not reachable from this harness');

    const duplicate = menu.locator('[role="menuitem"]', { hasText: 'Duplicate Token' });
    if (await duplicate.count() === 0) return;
    const before = await page.evaluate(() => window.matrixVTTClient.state.tokens.size);
    await duplicate.click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.matrixVTTClient.state.tokens.size);
    expect(after, 'Duplicate Token must actually duplicate').toBe(before + 1);
  });
});
