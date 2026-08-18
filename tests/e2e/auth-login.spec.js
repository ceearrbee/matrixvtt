/**
 * The pre-game funnel's first screen: login. Gated behaviors:
 *  - the flow probe runs on mount, so SSO appears for the PREFILLED
 *    homeserver without any input event
 *  - a submitted password login lands on the discovery screen
 *  - a rejected login shows translated copy, never a raw SDK error
 */
import { test, expect, gotoLogin } from './fixtures/fresh-visitor.js';

test.describe('standalone login', () => {
  test('password login lands on the discovery screen', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');

    await expect(page.locator('#discovery-userid')).toContainText('@playwright:fake.matrix.test');
  });

  test('SSO button appears for the prefilled homeserver with no input event', async ({ page }) => {
    await page.addInitScript(() => {
      window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
        loginFlows: [{ type: 'm.login.sso' }, { type: 'm.login.password' }],
      });
    });
    await gotoLogin(page);
    await expect(page.locator('#sso-btn')).toBeVisible();
    await expect(page.locator('#username')).toBeEnabled();
  });

  test('a rejected login shows friendly copy, not a raw error', async ({ page }) => {
    await page.addInitScript(() => {
      window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
        loginError: { errcode: 'M_FORBIDDEN', message: 'MatrixError: [403] Forbidden' },
      });
    });
    await gotoLogin(page);
    await page.fill('#username', 'playwright');
    await page.fill('#password', 'wrong');
    await page.click('#login-form button[type="submit"]');

    const error = page.locator('#login-error');
    await expect(error).toContainText(/wrong username or password/i);
    await expect(error).not.toContainText('MatrixError');
  });
});
