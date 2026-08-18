/**
 * Modal smoke - open each top-level modal via the ui-method opener,
 * assert it renders, close it. Catches structural breaks in any
 * single modal without requiring deep interaction tests.
 *
 * Skips modals that need preconditions we don't seed (attack flow
 * needs a token, character wizard needs no characters, etc.).
 */
import { test, expect, waitForVttShell } from './fixtures/logged-in.js';

const SIMPLE_MODALS = [
  { name: 'showItemForm', selector: '#item-form-modal', closeRole: /cancel/i },
  { name: 'showSpellForm', selector: '#spell-form-modal', closeRole: /cancel/i },
  { name: 'showHandoutForm', selector: '#handout-form-modal', closeRole: /cancel/i },
  { name: 'showTableForm', selector: '#table-form-modal', closeRole: /cancel/i },
  { name: 'showImportMarkdownDialog', selector: '#import-md-modal', closeRole: /close/i },
];

for (const { name, selector } of SIMPLE_MODALS) {
  test(`ui.${name} opens its modal without console errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Konva|Failed to load resource/.test(m.text())) {
        errors.push(`console.error: ${m.text()}`);
      }
    });

    await waitForVttShell(page);
    await page.evaluate((fn) => window.matrixVTTClient.ui[fn](), name);
    await expect(page.locator(selector)).toBeVisible({ timeout: 5_000 });
    expect(errors, `errors opening ${name}:\n${errors.join('\n')}`).toEqual([]);
  });
}

test('every ui-method opener is a function', async ({ page }) => {
  await waitForVttShell(page);
  const exposed = await page.evaluate(() => {
    const ui = window.matrixVTTClient?.ui;
    if (!ui) return null;
    return Object.fromEntries(
      ['showItemForm', 'showSpellForm', 'showHandoutForm', 'showTableForm',
       'showImportMarkdownDialog', 'showEntityForm', 'showEditCharacterForm',
       'showAddNPCForm', 'showCharacterPreview', 'showNPCPreview',
       'showItemPreview', 'showSpellPreview', 'openSettings',
       'showFirstTimeSetup'].map((k) => [k, typeof ui[k]])
    );
  });
  for (const [k, t] of Object.entries(exposed ?? {})) {
    expect(t, `ui.${k} should be a function`).toBe('function');
  }
});
