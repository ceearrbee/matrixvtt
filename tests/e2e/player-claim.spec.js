/**
 * Player perspective (PL 0): the least-tested paths a stranger hits
 * first. The welcome adapts to character availability, claiming works,
 * and GM-only chrome stays hidden.
 */
import {
  test, expect, waitForVttShell,
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
  test('welcome offers claiming when characters exist; claim writes state', async ({ page }) => {
    await playerConfig(page);
    await waitForVttShell(page);

    const welcome = page.locator('[aria-labelledby="player-welcome-title"]');
    await expect(welcome).toBeVisible({ timeout: 15_000 });
    await expect(welcome).toContainText(/claim/i);
    await welcome.getByRole('button', { name: 'Got it' }).click();

    // GM-only chrome must not exist for a PL-0 player.
    await expect(page.locator('#gm-controls-btn')).toHaveCount(0);
    await expect(page.locator('#new-entity-btn')).toHaveCount(0);

    // Claim from the sidebar sheet.
    await page.locator('[data-character-card], .char-list li, [data-entity-card]').first().click();
    const claim = page.getByRole('button', { name: /claim this character/i });
    await expect(claim).toBeVisible({ timeout: 10_000 });
    const before = await page.evaluate(() => (window.__VTT_E2E_SENT_EVENTS || []).length);
    await claim.click();
    await expect
      .poll(async () => page.evaluate(() => (window.__VTT_E2E_SENT_EVENTS || []).length))
      .toBeGreaterThan(before);
  });

  test('welcome does not promise claiming in an empty room', async ({ page }) => {
    await playerConfig(page, { withCharacter: false });
    await page.goto('app.html');

    const welcome = page.locator('[aria-labelledby="player-welcome-title"]');
    await expect(welcome).toBeVisible({ timeout: 15_000 });
    await expect(welcome).not.toContainText(/claim/i);
    await expect(welcome).toContainText(/no characters/i);
  });
});
