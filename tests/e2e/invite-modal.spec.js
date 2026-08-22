/**
 * GM-side invite modal: the player link is the headline, the share
 * message and the matrix.to link are one click away, and an
 * invite-only room offers the switch to join requests.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

async function openInviteModal(page) {
  await waitForVttShell(page);
  await page.locator('.left-index__menu-btn').click();
  await page.locator('[data-menu-item="invite"]').click();
  const modal = page.locator('#invite-player-modal');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('invite modal', () => {
  test('leads with a MatrixVTT player link and keeps the Matrix link nearby', async ({ page }) => {
    const modal = await openInviteModal(page);

    await expect(modal.locator('#invite-player-link')).toHaveValue(/app\.html\?join=/);
    await expect(modal.locator('#copy-player-link-btn')).toBeVisible();
    await expect(modal.locator('#copy-invite-message-btn')).toBeVisible();

    await modal.locator('summary', { hasText: 'Matrix link' }).click();
    await expect(modal.locator('#invite-matrix-to-link')).toHaveValue(/matrix\.to/);
  });

  test('states who can get in and can switch an invite-only room to join requests', async ({ page }) => {
    const modal = await openInviteModal(page);
    const access = modal.locator('#invite-access-state');
    await expect(access).toBeVisible();

    const switchBtn = modal.locator('#allow-knock-btn');
    if (await switchBtn.count()) {
      await switchBtn.click();
      await expect(access).toContainText(/ask to join/i);
      const sent = await page.evaluate(() => window.__VTT_E2E_SENT_EVENTS || []);
      expect(sent.some((e) => e.type === 'm.room.join_rules')).toBe(true);
    } else {
      await expect(access).toContainText(/join/i);
    }
  });
});
