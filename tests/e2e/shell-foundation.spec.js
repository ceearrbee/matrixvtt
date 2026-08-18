/**
 * Sanity check for the fake-matrix-client + logged-in fixture: prove
 * that with a seeded sessionStorage and the fake injected, the
 * standalone app reaches the VTT shell without any real Matrix
 * network calls. Every other logged-in spec depends on this working.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

test('logged-in fixture lands in the VTT shell', async ({ page }) => {
  await waitForVttShell(page);
  // The shell's #app container exists and is no longer showing the
  // "Connecting…" loading state.
  await expect(page.locator('#app')).toBeVisible();
});

test('no console errors during shell boot', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  await waitForVttShell(page);
  expect(errors, `unexpected errors:\n${errors.join('\n')}`).toEqual([]);
});
