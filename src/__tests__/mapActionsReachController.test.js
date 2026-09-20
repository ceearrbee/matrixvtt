/**
 * Map actions must reach the UI controller through the renderer, not
 * through `window.ui`.
 *
 * `_setupDevHelpers` assigns `window.ui` only under
 * `import.meta.env.DEV`. Every call site was optional-chained, so in a
 * real build these did nothing and said nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { removeToken } from '../map/actions/tokens.js';

const REAL_WINDOW_UI = /** @type {any} */ (globalThis).ui;

beforeEach(() => { delete (/** @type {any} */ (globalThis)).ui; });
afterEach(() => { (/** @type {any} */ (globalThis)).ui = REAL_WINDOW_UI; });

function makeMr(ui) {
  return {
    _ui: ui,
    selectedToken: null,
    setSelectedToken: vi.fn(),
    state: {
      selectedToken: null,
      tokens: new Map([['tok-1', { id: 'tok-1', name: 'Orc' }]]),
      updateToken: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function confirmNow() {
  const btn = document.querySelector('#remove-confirm-btn');
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return new Promise((r) => setTimeout(r, 30));
}

describe('removeToken', () => {
  // Its own comment: "Mid-combat removals must drop the initiative
  // entry; otherwise the next-turn cycle lands on a tombstoned token id."
  it('drops the initiative entry without window.ui in scope', async () => {
    const ui = { removeFromInitiative: vi.fn().mockResolvedValue(undefined) };
    removeToken(makeMr(ui), 'tok-1');
    await confirmNow();
    expect(ui.removeFromInitiative).toHaveBeenCalledWith('tok-1');
    document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
  });
});

describe('no map module depends on the dev-only window.ui', () => {
  function jsFilesUnder(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...jsFilesUnder(full));
      else if (/\.jsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const mapDir = resolve(import.meta.dirname, '../map');
  it.each(jsFilesUnder(mapDir))('%s', (file) => {
    const source = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(source).not.toMatch(/window\.ui\b/);
  });
});
