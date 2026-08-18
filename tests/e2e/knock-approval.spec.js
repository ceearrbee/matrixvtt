/**
 * GM-side knock surfacing: pending knocks appear in the party tab,
 * Approve invites the knocker, Deny kicks the knock away. Runs
 * against the fake-matrix-client's knock seeding and its live
 * RoomState.events emitter.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

test.skip(({ isMobile }) => isMobile, 'desktop right-rail layout');

async function openPartyTab(page) {
  await waitForVttShell(page);
  const companion = page.locator('.right-companion');
  await companion.locator('.ctabs:not(.ctabs--sub) .ctab[data-tab="party"]').click();
}

test.describe('GM knock approval', () => {
  test('a seeded knock surfaces in the party tab and Approve invites the knocker', async ({ page }) => {
    await page.addInitScript(() => {
      window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
        knocks: [{ userId: '@kay:fake.matrix.test', displayname: 'Kay', reason: 'Thursday group' }],
      });
    });
    await openPartyTab(page);

    const row = page.locator('[data-knock-user="@kay:fake.matrix.test"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText('Kay');
    await expect(row).toContainText('Thursday group');

    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row).toHaveCount(0);

    const invites = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => e.kind === 'invite'));
    expect(invites).toHaveLength(1);
    expect(invites[0].user_id).toBe('@kay:fake.matrix.test');
  });

  test('a live knock arrives via member event and Deny kicks it away', async ({ page }) => {
    await openPartyTab(page);

    await page.evaluate(() => {
      window.__VTT_E2E_EMIT_MEMBER_EVENT('@late:fake.matrix.test', 'knock', { displayname: 'Late Larry' });
    });

    const row = page.locator('[data-knock-user="@late:fake.matrix.test"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText('Late Larry');

    await row.getByRole('button', { name: 'Deny' }).click();
    await expect(row).toHaveCount(0);

    const kicks = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => e.kind === 'kick'));
    expect(kicks).toHaveLength(1);
    expect(kicks[0].user_id).toBe('@late:fake.matrix.test');
  });

  test('an approved knocker lands in the room member list', async ({ page }) => {
    await page.addInitScript(() => {
      window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
        knocks: [{ userId: '@kay:fake.matrix.test', displayname: 'Kay', reason: '' }],
      });
    });
    await openPartyTab(page);

    const row = page.locator('[data-knock-user="@kay:fake.matrix.test"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row).toHaveCount(0);

    await page.evaluate(() => {
      window.__VTT_E2E_EMIT_MEMBER_EVENT('@kay:fake.matrix.test', 'join', { displayname: 'Kay' });
    });
    await page.waitForFunction(() =>
      (window.matrixVTTClient?.state?.roomMembers || [])
        .some((m) => m.userId === '@kay:fake.matrix.test'));
  });
});
