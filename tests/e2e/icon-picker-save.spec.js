/**
 * End-to-end coverage for the built-in icon library picker.
 *
 * Catches two production-only regressions that unit tests can't:
 *  1. Form save rejected because `<input type="url">` refused the
 *     `/matrixvtt/icons/<…>.svg` path the picker writes.
 *  2. Picker tile or form preview rendered blank because the resolved
 *     URL didn't actually fetch a real file from `dist/icons/`.
 *
 * Runs against the prod-build Vite preview, so it exercises the real
 * static-asset pipeline, real form submission, and the real schema
 * validators.
 */
import { test, expect, openSheetRail } from './fixtures/logged-in.js';

const LIBRARY_URL_RE = /\/matrixvtt\/icons\/(dark|light)\/[^/]+\/[^/]+\.svg$/;

async function openHandoutForm(page) {
  await openSheetRail(page);
  await page.evaluate(() => window.matrixVTTClient.ui.showHandoutForm());
  await expect(page.locator('#handout-form-modal')).toBeVisible({ timeout: 5_000 });
}

async function openPickerFromHandout(page) {
  await page.locator('#handout-pick-icon').click();
  await expect(page.locator('#icon-picker-modal')).toBeVisible({ timeout: 5_000 });
  // Wait until the manifest has been fetched and at least one tile
  // has rendered. The grid is virtualized via content-visibility so
  // tiles appear in batches.
  await expect(page.locator('.icon-picker__tile').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('icon picker - save flow', () => {
  test('selecting an icon writes a library path into the handout image input', async ({ page }) => {
    await openHandoutForm(page);
    await openPickerFromHandout(page);

    const firstTile = page.locator('.icon-picker__tile').first();
    const iconId = await firstTile.getAttribute('data-id');
    expect(iconId).toBeTruthy();

    await firstTile.click();
    await expect(page.locator('#icon-picker-modal')).toHaveCount(0);

    const input = page.locator('#handout-image');
    await expect(input).toHaveValue(LIBRARY_URL_RE);
    expect(await input.inputValue()).toContain(iconId);
  });

  test('picked URL passes browser form validation (no type="url" regression)', async ({ page }) => {
    await openHandoutForm(page);
    await openPickerFromHandout(page);
    await page.locator('.icon-picker__tile').first().click();

    // input.validity.typeMismatch is true when an <input type="url">
    // holds a value that isn't a fully-qualified URL - which is what
    // killed save when library paths landed in a type="url" field.
    // With type="text" the constraint doesn't apply and the flag
    // stays false regardless of the value.
    const inputValidity = await page.evaluate(() => {
      const input = /** @type {HTMLInputElement|null} */ (
        document.querySelector('#handout-image')
      );
      if (!input) return { found: false };
      return {
        found: true,
        type: input.type,
        valid: input.validity.valid,
        typeMismatch: input.validity.typeMismatch,
        value: input.value,
      };
    });
    expect(inputValidity.found, 'expected #handout-image input to be present').toBe(true);
    expect(inputValidity.type, 'image_url fields must use type="text"').not.toBe('url');
    expect(inputValidity.typeMismatch, 'library path rejected as malformed URL').toBe(false);
    expect(inputValidity.valid, 'input.validity.valid must be true on a library path').toBe(true);
    expect(inputValidity.value).toMatch(LIBRARY_URL_RE);
  });

  test('handout form actually saves when title + library-picked icon are filled in', async ({ page }) => {
    await openHandoutForm(page);
    await page.locator('#handout-title').fill('Library Icon Smoke Test');
    await openPickerFromHandout(page);
    await page.locator('.icon-picker__tile').first().click();

    // Click the submit button (the only btn-primary in the modal).
    await page.locator('#handout-form-modal #handout-submit').click();

    // A successful submit removes the modal from the DOM. A blocked
    // submit (the type="url" regression) leaves the modal mounted
    // with the input marked :invalid.
    await expect(page.locator('#handout-form-modal')).toHaveCount(0, { timeout: 5_000 });
  });

  test('selected icon URL resolves to a real file (HTTP 200, non-empty body)', async ({ page }) => {
    await openHandoutForm(page);
    await openPickerFromHandout(page);
    await page.locator('.icon-picker__tile').first().click();

    const url = await page.locator('#handout-image').inputValue();
    // The page already loaded the SVG for the tile, so this fetch
    // is served from cache. We assert the wire-level outcome to
    // catch build-pipeline breaks that would silently 404.
    const response = await page.request.get(url);
    expect(response.status(), `${url} returned ${response.status()}`).toBe(200);
    const body = await response.body();
    expect(body.length, 'SVG body must not be empty').toBeGreaterThan(0);
    expect(body.toString('utf8').slice(0, 100)).toContain('<svg');
  });

  test('picker tile thumbnails render with non-zero natural dimensions', async ({ page }) => {
    await openHandoutForm(page);
    await openPickerFromHandout(page);

    // Wait for the first tile's <img> to actually decode. Picker
    // tiles use loading="lazy"; once visible the browser starts
    // decoding, and naturalWidth becomes non-zero on success.
    const firstImg = page.locator('.icon-picker__tile img').first();
    await firstImg.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const img = document.querySelector('.icon-picker__tile img');
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 10_000 });

    const naturalWidth = await firstImg.evaluate((/** @type {HTMLImageElement} */ el) => el.naturalWidth);
    expect(naturalWidth, 'tile <img> failed to decode - URL likely 404').toBeGreaterThan(0);
  });

  test('theme toggle in the picker flips both tile backdrop and rendered icons', async ({ page }) => {
    await openHandoutForm(page);
    await openPickerFromHandout(page);

    const grid = page.locator('.icon-picker__grid-wrap');
    const initialTheme = await grid.getAttribute('data-icon-theme');
    expect(initialTheme).toMatch(/^(dark|light)$/);

    // Click the theme switch (role=switch in the header).
    await page.locator('#icon-picker-modal [role="switch"]').click();

    const newTheme = await grid.getAttribute('data-icon-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Tiles must have a non-transparent backdrop so the icon stays
    // visible. Without `[data-icon-theme]` CSS that pairs the
    // backdrop with the icon colour, a white-on-white render would
    // slip through.
    const bg = await page.locator('.icon-picker__tile').first().evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(bg, 'tile backdrop must be a real colour, not transparent').not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the close button dismisses the picker without writing to the form', async ({ page }) => {
    await openHandoutForm(page);
    const before = await page.locator('#handout-image').inputValue();
    await openPickerFromHandout(page);
    // Close via the picker's own × button (Escape would also close the
    // underlying handout modal because ModalFactory's document-level
    // Escape handler fires on every layered modal - the picker close
    // button is the user-facing dismiss path).
    await page.locator('#icon-picker-modal button[aria-label="Close"]').click();
    await expect(page.locator('#icon-picker-modal')).toHaveCount(0);
    const after = await page.locator('#handout-image').inputValue();
    expect(after).toBe(before);
  });
});

/**
 * Sheet → token propagation. Without `_sheetUpsert` in
 * entity-writers.js, picking a new icon on the NPC sheet form would
 * update the sheet but leave the placed token rendering the old
 * portrait - exactly the regression the user reported.
 *
 * Seeds the NPC + token directly through the StateManager facade
 * because the fake-matrix-client's `initialState` mechanism predates
 * the Yjs migration and only the snapshot path is loaded now. The
 * direct seed exercises the same writer code path real edits use.
 */
test.describe('sheet portrait propagates to bound tokens', () => {
  const ORIG_URL = '/matrixvtt/icons/dark/delapouite/orc-head.svg';

  async function seedNpcAndToken(page) {
    await page.evaluate(({ url }) => {
      const sm = window.matrixVTTClient.state;
      sm.yjs.doc.transact(() => {
        sm.yjs.npcsMap.set('npc-orc', {
          id: 'npc-orc', name: 'Orc Warlord', type: 'npc',
          hp_max: 25, hp_current: 25, ac: 13, speed: 30,
          cr: '2', size_category: 'Medium',
          image_url: url,
        });
        sm.yjs.tokensMap.set('tok-orc', {
          id: 'tok-orc', map_id: 'playwright-map', name: 'Orc Warlord',
          type: 'npc', sheet_id: 'npc-orc',
          col: 5, row: 5, size: 1,
          hp_max: 25, hp_current: 25, ac: 13, visible: true,
          color: '#dc2626', image_url: url,
        });
      });
    }, { url: ORIG_URL });
    // Bridge fires async - wait for the ReactiveMap to mirror the seed.
    await page.waitForFunction(() => {
      const sm = window.matrixVTTClient?.state;
      return !!(sm?.npcs?.get('npc-orc') && sm?.tokens?.get('tok-orc'));
    }, null, { timeout: 5_000 });
  }

  async function openNpcEditForm(page) {
    await openSheetRail(page);
    await seedNpcAndToken(page);
    await page.evaluate(() => {
      window.matrixVTTClient.ui.showEntityForm('npc', 'npc-orc');
    });
    await expect(page.locator('#entity-form-modal')).toBeVisible({ timeout: 5_000 });
  }

  async function readTokenImageUrl(page) {
    return page.evaluate(() => {
      const t = window.matrixVTTClient.state.tokens.get('tok-orc');
      return t?.image_url ?? null;
    });
  }

  test('picking a new icon on an NPC sheet updates the bound token', async ({ page }) => {
    await openNpcEditForm(page);
    const before = await readTokenImageUrl(page);
    expect(before).toBeTruthy();

    // Open the picker and pick something other than the current icon.
    await page.locator('#entity-form-modal button:has-text("Browse library")').click();
    await expect(page.locator('#icon-picker-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.icon-picker__tile').first()).toBeVisible({ timeout: 10_000 });

    // Walk the list until we hit a tile whose URL differs from the
    // current portrait (avoids a false-pass when the first tile is
    // identical to the seed).
    const newUrl = await page.evaluate((current) => {
      const tiles = Array.from(document.querySelectorAll('.icon-picker__tile'));
      for (const tile of tiles) {
        const img = tile.querySelector('img');
        if (img && img.src !== current && !img.src.endsWith(current.replace(/^.*\//, ''))) {
          tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return img.src;
        }
      }
      return null;
    }, before);
    expect(newUrl, 'expected to find a tile different from the current icon').toBeTruthy();

    await expect(page.locator('#icon-picker-modal')).toHaveCount(0);

    // Save the form. EntityForm uses a real <form> + submit button.
    await page.locator('#entity-form-modal #entity-submit-btn').click();
    await expect(page.locator('#entity-form-modal')).toHaveCount(0, { timeout: 5_000 });

    // The bound token must now hold the new URL - without propagation
    // it would still equal `before`.
    await expect.poll(() => readTokenImageUrl(page), { timeout: 5_000 })
      .not.toBe(before);

    const after = await readTokenImageUrl(page);
    expect(after).toMatch(LIBRARY_URL_RE);
  });

  test('removing an NPC sheet portrait clears the bound token', async ({ page }) => {
    await openNpcEditForm(page);
    const before = await readTokenImageUrl(page);
    expect(before).toBeTruthy();

    // Click Remove next to the portrait preview.
    const removeBtn = page.locator('#entity-form-modal button:has-text("Remove")').first();
    await removeBtn.click();

    await page.locator('#entity-form-modal #entity-submit-btn').click();
    await expect(page.locator('#entity-form-modal')).toHaveCount(0, { timeout: 5_000 });

    // The token's image_url must be null (or empty) after the sheet
    // is cleared. The Konva renderer falls back to the coloured
    // circle when image_url is falsy.
    await expect.poll(() => readTokenImageUrl(page), { timeout: 5_000 })
      .toBeFalsy();
  });
});
