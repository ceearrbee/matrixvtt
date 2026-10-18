/**
 * The login and discovery screens on a short window: html and body never
 * scroll (the VTT owns the viewport), so anything below the fold was out
 * of reach. The wheel is the user's scroll, not scrollIntoView, which
 * moves even an overflow: hidden box.
 */
import { test, expect } from './fixtures/fresh-visitor.js';

test.skip(({ isMobile }) => isMobile, 'mobile WebKit has no mouse wheel');

const SHORT = { width: 1280, height: 480 };

test.use({ viewport: SHORT });

async function wheelOver(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height, 400) / 2);
  await page.mouse.wheel(0, 4000);
}

// Signs in on a tall window so filling the form scrolls nothing, then
// shrinks it.
async function signIn(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('app.html');
  await page.fill('#username', 'playwright');
  await page.fill('#password', 'hunter2');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#discovery-userid')).toContainText('@playwright');
  await page.setViewportSize(SHORT);
}

test.describe('standalone screens scroll on a short window', () => {
  test('the login form scrolls down to its submit button', async ({ page }) => {
    await page.goto('app.html');
    const submit = page.locator('#login-form button[type="submit"]');
    await expect(submit).toBeVisible({ timeout: 15_000 });
    await expect(submit).not.toBeInViewport();
    await wheelOver(page, '.standalone-main');
    await expect(submit).toBeInViewport();
  });

  test('discovery scrolls down to the create campaign controls', async ({ page }) => {
    await signIn(page);
    await expect(page.locator('#create-room-knock')).not.toBeInViewport();
    await wheelOver(page, '.standalone-main');
    await expect(page.locator('#create-room-knock')).toBeInViewport();
  });

  test('discovery scrolls to the bottom with all joined rooms shown', async ({ page }) => {
    await signIn(page);
    await page.locator('#other-rooms-toggle').click();
    await expect(page.locator('#other-list .room-card')).not.toHaveCount(0);
    await wheelOver(page, '.standalone-main');
    await expect(page.locator('#create-room-knock')).toBeInViewport();
  });

  test('on a phone the sidebar stacks at full height above the login form', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('app.html');
    const submit = page.locator('#login-form button[type="submit"]');
    await expect(submit).toBeVisible({ timeout: 15_000 });
    const clipped = await page.locator('.standalone-sidebar')
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(clipped).toBeLessThanOrEqual(1);
    await wheelOver(page, '.standalone-sidebar');
    await expect(submit).toBeInViewport();
  });

  test('the sidebar scrolls down to its reference links', async ({ page }) => {
    await signIn(page);
    const sourceLink = page.getByRole('link', { name: 'Source code' });
    await expect(sourceLink).not.toBeInViewport();
    await wheelOver(page, '.standalone-sidebar');
    await expect(sourceLink).toBeInViewport();
  });
});
