/**
 * A Matrix room that holds no campaign opens straight to its chat,
 * sends nothing to the room, and offers setup only when asked. The room
 * says once that everything in it can be read. Encrypted rooms are
 * refused before anything loads.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'path';

const FAKE = resolve(import.meta.dirname, 'fixtures/fake-matrix-client.js');
const ME = '@playwright:fake.matrix.test';
const ROOM = '!plain:fake.matrix.test';

async function openPlainRoom(page, { powerLevel = 100, extraState = [] } = {}) {
  await page.addInitScript({ path: FAKE });
  await page.addInitScript(({ me, room, level, extra }) => {
    localStorage.setItem('vtt-auth-session', JSON.stringify({
      homeserver: 'https://fake.matrix.test', accessToken: 'fake', userId: me, displayName: 'Playwright User',
    }));
    localStorage.setItem('vtt:active-room', JSON.stringify({ roomId: room, roomName: 'Plain Chat' }));
    window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
      roomId: room,
      roomName: 'Plain Chat',
      powerLevel: level,
      initialState: [
        {
          type: 'm.room.power_levels', state_key: '',
          content: { users: level >= 50 ? { [me]: level } : {}, users_default: 0, state_default: 50 },
        },
        ...extra,
      ],
    });
  }, { me: ME, room: ROOM, level: powerLevel, extra: extraState });
  await page.goto('app.html');
}

const sentToRoom = (page) => page.evaluate(() =>
  (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => e.kind === 'room' || e.kind === 'state'));

test.describe('a room with no campaign', () => {
  test('a GM lands in chat and the room receives nothing', async ({ page }) => {
    await openPlainRoom(page);
    await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.next-steps [data-step="setup"]')).toBeVisible();
    await expect(page.locator('#setup-wizard')).toHaveCount(0);
    await expect(page.locator('#waiting-gm-modal')).toHaveCount(0);

    // The first sync check would go out at five seconds.
    await page.waitForTimeout(7_000);
    expect(await sentToRoom(page)).toEqual([]);
  });

  test('Set up a campaign opens the wizard on request', async ({ page }) => {
    await openPlainRoom(page);
    await page.locator('.next-steps [data-step="setup"]').click();
    await expect(page.locator('#setup-wizard')).toBeVisible({ timeout: 15_000 });
  });

  test('a player is told there is no campaign, without a dialog', async ({ page }) => {
    await openPlainRoom(page, { powerLevel: 0 });
    await expect(page.locator('.next-steps')).toContainText('No campaign in this room yet', { timeout: 15_000 });
    await expect(page.locator('#waiting-gm-modal')).toHaveCount(0);
    await expect(page.locator('.next-steps__chip')).toHaveCount(0);
  });

  test('the room says once that everything here can be read', async ({ page }) => {
    await openPlainRoom(page);
    const notice = page.locator('.room-notice');
    await expect(notice).toContainText('Treat this room as public', { timeout: 15_000 });
    await notice.getByRole('button', { name: 'Got it' }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.room-notice')).toHaveCount(0);
  });

  test('a public room is marked in the header and in the notice', async ({ page }) => {
    await openPlainRoom(page, {
      extraState: [{ type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } }],
    });
    await expect(page.locator('.vtt-header .room-access')).toHaveText('Public room', { timeout: 15_000 });
    await expect(page.locator('.room-notice')).toContainText('anyone can join and read it');
  });
});

test('an encrypted room is refused before it loads', async ({ page }) => {
  await openPlainRoom(page, {
    extraState: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }],
  });
  await expect(page.locator('#discovery-error')).toContainText('does not support encrypted rooms', { timeout: 15_000 });
  await expect(page.locator('.shell[data-ui-mode]')).toHaveCount(0);
  expect(await sentToRoom(page)).toEqual([]);
});
