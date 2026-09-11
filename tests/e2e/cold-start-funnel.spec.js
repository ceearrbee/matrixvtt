/**
 * The GM funnel, cold, end to end: land signed out, sign in, name the
 * campaign and pick a system once, create, and arrive at a shell that
 * hands over the invite link and the map.
 *
 * The plan this closes measured 14 discrete steps across 6 surfaces to
 * reach a playable table, with "Invite players" reachable only from the
 * lower-left menu - absent from the wizard, the completion toast and
 * all twelve tour steps. The step budget below is the point of the
 * spec: it fails if the funnel grows back.
 */
import { test, expect } from './fixtures/fresh-visitor.js';

// One step = one thing the GM has to decide or act on. Filling the name
// and picking the system are one step: they sit in one form.
const STEP_BUDGET = 6;

test.describe('cold start to a playable table', () => {
  test('reaches invite-link-and-map in the step budget', async ({ page }) => {
    const steps = [];
    const step = async (label, run) => { steps.push(label); await run(); };

    // 1. Land, signed out.
    await step('land on the login screen', async () => {
      await page.goto('app.html');
      await expect(page.locator('#login-form')).toBeVisible({ timeout: 15_000 });
    });

    // 2. Sign in.
    await step('sign in', async () => {
      await page.fill('#username', 'playwright');
      await page.fill('#password', 'hunter2');
      await page.click('#login-form button[type="submit"]');
      await expect(page.locator('#discovery-userid')).toContainText('@playwright');
    });

    // 3. Name it and pick a system, in one form.
    await step('name the campaign and pick a system', async () => {
      await page.fill('#create-room-input', 'Cold Start');
      await page.selectOption('#create-room-system', 'dnd5e');
      await expect(page.locator('#create-room-system-note')).not.toBeEmpty();
    });

    // 4. Create.
    await step('create the room', async () => {
      await page.click('#create-room-btn');
      await expect(page.locator('#setup-wizard')).toBeVisible({ timeout: 15_000 });
    });

    // 5. Confirm the campaign - one decision, one primary button.
    await step('confirm the campaign', async () => {
      const wizard = page.locator('#setup-wizard');
      await expect(wizard.locator('.wizard-actions .btn-primary')).toHaveCount(1);
      await wizard.getByRole('button', { name: 'Create campaign' }).click();
      await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });
      // Setup's progress modal must clear itself; a GM left staring at
      // a dead overlay is the failure this whole track is about.
      await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 15_000 });
    });

    // 6. The shell hands over the invite link and the map, without a
    //    hunt through the lower-left menu.
    await step('copy the invite link from the next-steps checklist', async () => {
      const checklist = page.locator('.next-steps');
      await expect(checklist).toBeVisible({ timeout: 15_000 });
      await expect(checklist.locator('[data-step="map"]')).toBeVisible();
      // Each step is a chip, and the chip is the CTA.
      await checklist.locator('[data-step="invite"]').click();
      await expect(page.locator('#invite-player-modal')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('#invite-player-modal')).toContainText('Copy player link');
    });

    expect(steps.length, steps.join(' -> ')).toBeLessThanOrEqual(STEP_BUDGET);
  });

  test('a GM not in Prep sees no scene-authoring chrome', async ({ page }) => {
    await page.goto('app.html');
    await page.fill('#username', 'playwright');
    await page.fill('#password', 'hunter2');
    await page.click('#login-form button[type="submit"]');
    await page.fill('#create-room-input', 'Prep Gate');
    await page.click('#create-room-btn');
    await expect(page.locator('#setup-wizard')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Create campaign' }).click();
    await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('[data-tool-group="gm"]')).toHaveCount(0);
    await expect(page.locator('#new-entity-btn')).toHaveCount(0);
    await expect(page.locator('#gm-controls-btn')).toHaveCount(0);

    await page.locator('#gm-prep-btn').click();
    await expect(page.locator('[data-tool-group="gm"]')).toBeVisible();
    await expect(page.locator('#new-entity-btn')).toBeVisible();
  });
});
