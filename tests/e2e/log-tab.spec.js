/**
 * LogPanel - the chat/dice/system feed. Lives in the channel rail
 * (left of the map column), no longer in the right-rail SheetPanel
 * tabs. The legacy `[data-tab="log"]` selector is gone - assertions
 * target the channel-rail `.log-panel` surface directly.
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

test.describe('log panel', () => {
  test('renders the channel-rail log panel root', async ({ page }) => {
    await waitForVttShell(page);
    await expect(page.locator('.log-panel').first()).toBeVisible({ timeout: 10_000 });
  });

  test('exposes a search / filter affordance', async ({ page }) => {
    await waitForVttShell(page);
    // LogControls renders a trigger button (.log-controls__trigger)
    // that opens a search + filter popover. Either the trigger or the
    // popover's search input proves the surface is wired.
    const trigger = page.locator('.log-controls__trigger');
    await expect(trigger.first()).toBeVisible({ timeout: 5_000 });
  });
});
