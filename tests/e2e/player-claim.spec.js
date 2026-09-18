/**
 * Player perspective (PL 0): the least-tested paths a stranger hits
 * first. The welcome adapts to character availability, claiming works,
 * and GM-only chrome stays hidden.
 */
import {
  test, expect, waitForVttShell, showMobilePane,
  SEED_INITIAL_STATE_NO_ACTORS, SEED_YJS_SNAPSHOT_NO_ACTORS_B64,
} from './fixtures/logged-in.js';

const PLAYER_ID = '@guest:fake.matrix.test';

function playerConfig(page, { withCharacter = true } = {}) {
  return page.addInitScript(({ playerId, withCharacter, actorlessState, actorlessSnapshot }) => {
    // Rewrite the seeded auth + fake config for a PL-0 player. The
    // logged-in fixture's script ran first; later init scripts win.
    const auth = JSON.parse(localStorage.getItem('vtt-auth-session'));
    auth.userId = playerId;
    auth.displayName = 'Guest Player';
    localStorage.setItem('vtt-auth-session', JSON.stringify(auth));
    localStorage.setItem('mxvtt:tour-completed::' + playerId, '1');

    const cfgPatch = { userId: playerId, powerLevel: 0 };
    if (!withCharacter) {
      // A set-up room (settings + map) with no authored actors: the
      // welcome must not promise a claimable character.
      cfgPatch.initialState = actorlessState;
      cfgPatch.yjsSnapshot = actorlessSnapshot;
    }
    window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, cfgPatch);
  }, {
    playerId: PLAYER_ID, withCharacter,
    actorlessState: SEED_INITIAL_STATE_NO_ACTORS,
    actorlessSnapshot: SEED_YJS_SNAPSHOT_NO_ACTORS_B64,
  });
}

test.describe('player-perspective entry', () => {
  test('the checklist asks a player for one thing; claim writes state', async ({ page, isMobile }) => {
    await playerConfig(page);
    await waitForVttShell(page);

    // The checklist reads live state, and under load the shell can
    // paint before the Yjs snapshot hydrates the seeded character. Wait
    // for the character to land so the chip is asserted in its settled
    // state rather than mid-hydration.
    // The PL-0 override has to have landed too: until it does, isGM is
    // true and the checklist renders the GM branch, which fails the chip
    // count below for a reason that has nothing to do with claiming.
    await page.waitForFunction(
      () => (window.matrixVTTClient?.state?.characters?.size ?? 0) > 0
        && window.matrixVTTClient?.state?.isGM?.() === false,
      null,
      { timeout: 15_000 },
    );

    // One first-run surface, not a modal on top of a tour: the
    // next-steps checklist, with exactly one item for a player.
    const checklist = page.locator('.next-steps');
    await expect(checklist).toBeVisible({ timeout: 15_000 });
    await expect(checklist.locator('[data-step="character"]')).toContainText(/claim/i);
    await expect(checklist.locator('.next-steps__chip')).toHaveCount(1);

    // GM-only chrome must not exist for a PL-0 player.
    await expect(page.locator('#gm-controls-btn')).toHaveCount(0);
    await expect(page.locator('#new-entity-btn')).toHaveCount(0);

    // Claim from the sidebar sheet, which is its own pane on a phone.
    if (isMobile) await showMobilePane(page, 'panel');
    await page.locator('[data-character-card="chr-aria"]').click();
    const claim = page.getByRole('button', { name: /claim this character/i });
    await expect(claim).toBeVisible({ timeout: 10_000 });
    const before = await page.evaluate(() => (window.__VTT_E2E_SENT_EVENTS || []).length);
    await claim.click();
    // claimCharacter opens a confirm dialog and calls updateCharacter
    // only from its callback, so the Claim click on its own writes
    // nothing at all.
    await page.locator('[data-confirm]').click();

    // Assert the write, not just that some event went out: the state
    // change is what "claim writes state" means, and the send behind it
    // is debounced.
    await page.waitForFunction(
      (id) => window.matrixVTTClient?.state?.characters?.get('chr-aria')?.claimed_by_user_id === id,
      PLAYER_ID,
      { timeout: 15_000 },
    );
    await expect
      .poll(async () => page.evaluate(() => (window.__VTT_E2E_SENT_EVENTS || []).length),
        { timeout: 15_000 })
      .toBeGreaterThan(before);
  });

  test('the claim step stays open in a room with no characters yet', async ({ page }) => {
    await playerConfig(page, { withCharacter: false });
    await page.goto('app.html');

    const step = page.locator('.next-steps [data-step="character"]');
    await expect(step).toBeVisible({ timeout: 15_000 });
    await expect(step).toHaveAttribute('data-done', 'false');
    // The chip makes a sheet rather than promising one that isn't there.
    await expect(step).toHaveAttribute('title', /own/i);
  });
});
