/**
 * `canEditPage` has always granted a player the right to write a page
 * they authored. The only creation entry was the header Create menu,
 * behind `isGM && prepActive`, so the right was unreachable. The
 * Journal drawer, where a player actually looks, now offers it.
 */
import { test, expect, openJournal } from './fixtures/logged-in.js';

const PLAYER_ID = '@guest:fake.matrix.test';

function asPlayer(page) {
  return page.addInitScript((playerId) => {
    const auth = JSON.parse(localStorage.getItem('vtt-auth-session'));
    auth.userId = playerId;
    auth.displayName = 'Guest Player';
    localStorage.setItem('vtt-auth-session', JSON.stringify(auth));
    window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
      userId: playerId, powerLevel: 0,
    });
  }, PLAYER_ID);
}

test.describe('a player can write a page', () => {
  test('the Journal offers it, and it opens the page form', async ({ page }) => {
    await asPlayer(page);
    const journal = await openJournal(page);

    const cta = journal.getByRole('button', { name: /write a page/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.locator('#page-form-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('the handout CTA stays with the GM', async ({ page }) => {
    await asPlayer(page);
    const journal = await openJournal(page);
    await expect(journal.getByRole('button', { name: /add a handout/i })).toHaveCount(0);
  });
});
