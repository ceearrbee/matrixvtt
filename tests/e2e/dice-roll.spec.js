/**
 * Dice bar: opening the quick-roll strip and clicking a die shows the
 * result inline, writes a log entry, and posts the roll to chat as an
 * m.room.message through the fake client.
 *
 * Desktop-only surface: the inline strip collapses behind the mobile
 * composer-actions popover on the iPhone project.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

test.describe('dice rolls', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'inline dice strip is desktop-only');
  });

  test('quick-roll d20 shows the result and posts it to chat', async ({ page }) => {
    await waitForVttShell(page);
    await page.locator('[data-dice-strip-toggle]').click();
    await page.locator('[data-dice="d20"]').click();

    // Inline result readout: "1d20 → [die] = total".
    const result = page.locator('#dice-result');
    await expect(result).toContainText('1d20');
    await expect(result.locator('.dice-result__total')).toHaveText(/^([1-9]|1[0-9]|20)$/);

    // The roll goes out to the room as a chat message.
    await page.waitForFunction(() => (window.__VTT_E2E_SENT_EVENTS || []).some(
      (e) => e.kind === 'room'
        && e.type === 'm.room.message'
        && /rolled 1d20/.test(e.content?.body || ''),
    ));
  });

  test('roll appears in the channel-rail log', async ({ page }) => {
    await waitForVttShell(page);
    await page.locator('[data-dice-strip-toggle]').click();
    await page.locator('[data-dice="d6"]').click();
    await expect(page.locator('.log-panel')).toContainText('1d6', { timeout: 10_000 });
  });
});
