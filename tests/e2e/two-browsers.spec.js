/**
 * The product's defining claim is that two people see the same table.
 * Every other spec drives one page, so nothing proved it.
 *
 * Two pages in one browser context each boot the fake matrix client;
 * the fake relays timeline events between them over a BroadcastChannel,
 * which is the seam com.matrixvtt.yjs.update travels through in
 * production. The fake is a message bus, not a CRDT: what is under test
 * is that an edit made in one page reaches the other and lands in its
 * runtime state.
 */
import { test, expect, seedPage, waitForVttReady } from './fixtures/logged-in.js';

const SECOND_USER = '@playwright-two:fake.matrix.test';

async function selectToken(page, tokenId) {
  await page.waitForFunction(
    (id) => !!window.matrixVTTClient?.ui?.mapRenderer?.stage
      && !!window.matrixVTTClient.ui.mapRenderer.state.tokens.get(id),
    tokenId,
  );
  await page.evaluate((id) => {
    document.activeElement?.blur?.();
    window.matrixVTTClient.ui.mapRenderer.setSelectedToken(id);
  }, tokenId);
}

test.describe('two browsers converge', () => {
  test('a token moved in one page arrives in the other', async ({ page, context }) => {
    const other = await context.newPage();
    await seedPage(other, { userId: SECOND_USER, displayName: 'Playwright Two' });

    await waitForVttReady(page);
    await waitForVttReady(other);

    await expect.poll(() => other.evaluate(
      () => window.matrixVTTClient.state.tokens.get('tok-aria')?.col,
    )).toBe(5);

    await selectToken(page, 'tok-aria');
    await page.waitForFunction(
      () => window.matrixVTTClient.ui.mapRenderer.selectedToken === 'tok-aria',
    );
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await other.waitForFunction(() => {
      const t = window.matrixVTTClient.state.tokens.get('tok-aria');
      return t?.col === 6 && t?.row === 6;
    }, null, { timeout: 15_000 });

    await other.close();
  });

  test('an edit in the second page comes back to the first', async ({ page, context }) => {
    const other = await context.newPage();
    await seedPage(other, { userId: SECOND_USER, displayName: 'Playwright Two' });

    await waitForVttReady(page);
    await waitForVttReady(other);

    await other.evaluate(async () => {
      const sm = window.matrixVTTClient.state;
      const token = sm.tokens.get('tok-orc');
      await sm.updateToken('tok-orc', { ...token, col: 2, row: 3 });
    });

    await page.waitForFunction(() => {
      const t = window.matrixVTTClient.state.tokens.get('tok-orc');
      return t?.col === 2 && t?.row === 3;
    }, null, { timeout: 15_000 });

    await other.close();
  });
});
