/**
 * Contract test: every entity form's image-URL field accepts a built-in
 * icon library path (`/matrixvtt/icons/dark/<author>/<name>.svg`) and
 * passes form.checkValidity() on save.
 *
 * Catches the regression class where switching the input to type="url"
 * makes the browser reject the path with "please update the URL" -
 * which silently blocks form submission.
 *
 * Asserts the live DOM contract that mounted modals produce, so it
 * survives refactors that move the input around inside the form.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LIBRARY_PATH = '/matrixvtt/icons/dark/lorc/broadsword.svg';
const HTTPS_URL = 'https://cdn.example.com/portrait.png';
const MXC_URI = 'mxc://example.com/abc123';

function makeForm(innerHtml) {
  document.body.innerHTML = `<form>${innerHtml}</form>`;
  return /** @type {HTMLFormElement} */ (document.body.querySelector('form'));
}

function assertAccepts(input, value) {
  input.value = value;
  // happy-dom mirrors HTMLInputElement.checkValidity() against the
  // type=url ValidityState constraint. type="text" passes everything;
  // type="url" rejects bare paths.
  expect(input.checkValidity(), `value=${JSON.stringify(value)}`).toBe(true);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('image-URL form inputs accept library paths, mxc URIs, and HTTPS URLs', () => {
  it('token portrait input (TokenFormModal / PortraitUploader)', () => {
    const form = makeForm(`<input id="token-image-url" type="text" class="form-input">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('#token-image-url'));
    assertAccepts(input, LIBRARY_PATH);
    assertAccepts(input, HTTPS_URL);
    assertAccepts(input, MXC_URI);
    expect(form.checkValidity()).toBe(true);
  });

  it('entity portrait input (EntityForm / PortraitField)', () => {
    const form = makeForm(`<input id="entity-image-url" type="text" class="form-input">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('#entity-image-url'));
    assertAccepts(input, LIBRARY_PATH);
    assertAccepts(input, HTTPS_URL);
    assertAccepts(input, MXC_URI);
  });

  it('item icon input (items-tab.js modal)', () => {
    const form = makeForm(`<input id="item-image-url" type="text" class="form-input">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('#item-image-url'));
    assertAccepts(input, LIBRARY_PATH);
  });

  it('spell icon input (spells-tab.js modal)', () => {
    const form = makeForm(`<input id="spell-image-url" type="text" class="form-input">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('#spell-image-url'));
    assertAccepts(input, LIBRARY_PATH);
  });

  it('handout image input (handouts-panel.js modal)', () => {
    const form = makeForm(`<input id="handout-image" type="text" class="form-input">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('#handout-image'));
    assertAccepts(input, LIBRARY_PATH);
  });

  it('map backdrop layer input (MapForm.jsx)', () => {
    const form = makeForm(`<input class="form-input layer-url" type="text">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('.layer-url'));
    assertAccepts(input, LIBRARY_PATH);
  });

  it('regression sentinel: type="url" rejects /matrixvtt/icons/... paths', () => {
    // If this assertion ever flips to true, type="url" no longer
    // rejects bare paths and the production guards (scan-bad-patterns
    // + this contract) can be relaxed. Until then, anything that
    // holds an image_url must use type="text".
    const form = makeForm(`<input type="url">`);
    const input = /** @type {HTMLInputElement} */ (form.querySelector('input'));
    input.value = LIBRARY_PATH;
    expect(input.checkValidity()).toBe(false);
  });
});

/**
 * Source-level cross-check: every entity image-URL input in src/ uses
 * type="text", not type="url". Pairs with scripts/scan-bad-patterns.sh
 * - runs in the test suite so regressions are caught without needing
 * the bash hook.
 */
describe('source code: no entity image_url input uses type="url"', () => {
  const FILES = [
    'src/ui/token-form/PortraitUploader.jsx',
    'src/ui/entity-form/PortraitField.jsx',
    'src/ui/items-tab.js',
    'src/ui/spells-tab.js',
    'src/ui/handouts-panel.js',
    'src/ui/MapForm.jsx',
  ];

  for (const file of FILES) {
    it(`${file} does not use type="url" on an image_url input`, () => {
      const root = path.resolve(__dirname, '..', '..');
      const src = fs.readFileSync(path.resolve(root, file), 'utf8');
      // type="url" in HTML strings
      expect(src, file).not.toMatch(/type="url"/);
      // type: 'url' in JSX h() calls
      expect(src, file).not.toMatch(/type:\s*'url'/);
    });
  }
});
