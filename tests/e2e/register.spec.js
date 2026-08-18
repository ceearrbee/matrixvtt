/**
 * In-app registration: the auth screen's Create account entry walks a
 * registration_token + terms UIA flow against the fake homeserver and
 * lands the fresh account on the discovery screen.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'path';

const FAKE_SCRIPT = resolve(import.meta.dirname, 'fixtures/fake-matrix-client.js');

test.describe('in-app registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: FAKE_SCRIPT });
  });

  test('token + terms flow creates the account and signs in', async ({ page }) => {
    await page.goto('app.html');
    await expect(page.locator('#login-form')).toBeVisible();

    await page.locator('#show-register-btn').click();
    await expect(page.locator('#register-form')).toBeVisible();
    await expect(page.getByText('Privacy Policy')).toBeVisible();

    await page.locator('#register-username').fill('newbie');
    await page.locator('#register-password').fill('hunter2hunter2');
    await page.locator('#register-token').fill('LETMEIN');
    await page.locator('#register-terms').check();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.locator('#create-room-input')).toBeVisible({ timeout: 10_000 });

    const registered = await page.evaluate(() =>
      (window.__VTT_E2E_SENT_EVENTS || []).filter((e) => e.kind === 'register'));
    expect(registered).toHaveLength(1);
    expect(registered[0].username).toBe('newbie');
  });

  test('a wrong registration token keeps the form with a clear error', async ({ page }) => {
    await page.goto('app.html');
    await page.locator('#show-register-btn').click();
    await expect(page.locator('#register-form')).toBeVisible();

    await page.locator('#register-username').fill('newbie');
    await page.locator('#register-password').fill('hunter2hunter2');
    await page.locator('#register-token').fill('WRONG');
    await page.locator('#register-terms').check();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/token was not accepted/i)).toBeVisible();
    await expect(page.locator('#register-form')).toBeVisible();
  });

  test('recaptcha-gated servers keep the element.io exit', async ({ page }) => {
    await page.addInitScript(() => {
      window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
        register: { flows: [{ stages: ['m.login.recaptcha', 'm.login.dummy'] }], params: {}, token: '' },
      });
    });
    await page.goto('app.html');
    await page.locator('#show-register-btn').click();

    await expect(page.getByText(/element\.io/i)).toBeVisible();
    await expect(page.locator('#register-username')).toHaveCount(0);
  });
});
