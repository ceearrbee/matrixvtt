/**
 * Combat and initiative: starting combat rolls an order for the seeded
 * tokens, broadcasts it as a com.matrixvtt.yjs.update timeline event
 * through the fake client, and the initiative tracker reflects the
 * live turn - including advancing to the next combatant.
 */
import { test, expect, waitForVttReady } from './fixtures/logged-in.js';

async function startCombat(page) {
  await page.getByRole('button', { name: 'Start combat and roll initiative' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Randomize all' }).click();
  await page.waitForFunction(() => window.matrixVTTClient.state.initiative.active === true);
}

test.describe('combat and initiative', () => {
  test('rolling initiative starts combat and broadcasts the order', async ({ page }) => {
    await waitForVttReady(page);
    await startCombat(page);

    const initiative = await page.evaluate(() => window.matrixVTTClient.state.initiative);
    expect(initiative.round).toBe(1);
    expect(initiative.current_index).toBe(0);
    expect(initiative.order).toHaveLength(2);
    expect(initiative.order.map((e) => e.token_id).sort()).toEqual(['tok-aria', 'tok-orc']);

    await page.waitForFunction(() => (window.__VTT_E2E_SENT_EVENTS || [])
      .some((e) => e.type === 'com.matrixvtt.yjs.update'));
  });

  test('initiative tracker shows the round and highlights the current combatant', async ({ page }) => {
    await waitForVttReady(page);
    await startCombat(page);

    // Starting combat switches the table into Combat phase, which swaps
    // the header subtitle to "Round N · <current name>" and replaces the
    // narrative InitiativeBar with the CombatInitiativeStrip.
    const currentName = await page.evaluate(() => {
      const { order, current_index } = window.matrixVTTClient.state.initiative;
      return order[current_index].name;
    });
    await expect(page.locator('.vtt-header__subtitle')).toHaveText(`Round 1 · ${currentName}`);
    await expect(page.locator('.combat-init-strip__row[data-current="true"]')).toContainText(currentName);
  });

  test('ending a turn advances to the next combatant', async ({ page }) => {
    await waitForVttReady(page);
    await startCombat(page);

    const before = await page.evaluate(() => window.matrixVTTClient.state.initiative.current_index);
    await page.locator('[data-action="end-turn"]').click();

    await page.waitForFunction(
      (i) => window.matrixVTTClient.state.initiative.current_index !== i,
      before,
    );
    const after = await page.evaluate(() => window.matrixVTTClient.state.initiative.current_index);
    expect(after).toBe((before + 1) % 2);

    await page.waitForFunction(() => (window.__VTT_E2E_SENT_EVENTS || [])
      .some((e) => e.type === 'com.matrixvtt.yjs.update'));
  });

  test('ending combat clears the initiative order', async ({ page }) => {
    await waitForVttReady(page);
    await startCombat(page);

    await page.locator('#gm-controls-btn').click();
    await page.locator('[data-gm-subnav-id="combat"]').click();
    await page.getByRole('button', { name: 'End combat and clear tracker' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End Combat', exact: true }).click();

    await page.waitForFunction(() => window.matrixVTTClient.state.initiative.active === false);
    const initiative = await page.evaluate(() => window.matrixVTTClient.state.initiative);
    expect(initiative.order).toHaveLength(0);
  });
});
