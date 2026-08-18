/**
 * Playwright fixture for specs that exercise the PRE-login funnel:
 * installs the fake MatrixClient but seeds NO auth, so the standalone
 * shell lands on the login screen. The tour-completed flag is set so
 * post-login flows don't fight the driver.js spotlight.
 */
import { test as base, expect } from '@playwright/test';
import { resolve } from 'path';

const FAKE_SCRIPT = resolve(import.meta.dirname, 'fake-matrix-client.js');

export const test = base.extend({
  freshVisitor: [async ({ page }, use) => {
    await page.addInitScript({ path: FAKE_SCRIPT });
    await page.addInitScript(() => {
      localStorage.setItem('vtt-tutorial-completed', 'true');
    });
    await use({});
  }, { auto: true }],
});

export { expect };

export async function gotoLogin(page) {
  await page.goto('app.html');
  await expect(page.locator('#login-form')).toBeVisible({ timeout: 15_000 });
}
