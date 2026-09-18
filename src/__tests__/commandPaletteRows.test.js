/**
 * The palette's result rows were the last string-HTML render on a hot
 * path: an innerHTML assignment over a template literal, escaped by a
 * hand-rolled _escapeHtml. This repo has already shipped a single-quote
 * XSS bug once. Preact escapes children structurally, so the rows are
 * rendered, not concatenated, and the escaper is gone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'preact/test-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { showCommandPalette } from '../ui/command-palette.js';

const HOSTILE = `<img src=x onerror="alert(1)">`;
const QUOTED = `O'Brien "the Rat" & Co`;

function makeUi() {
  return {
    state: {
      tokens: new Map([['t1', { id: 't1', name: HOSTILE }]]),
      characters: new Map([['c1', { id: 'c1', name: QUOTED }]]),
      npcs: new Map(), items: new Map(), spells: new Map(),
      handouts: new Map(), pins: new Map(),
    },
    mapRenderer: { panToToken: vi.fn(), panTo: vi.fn() },
    previewToken: vi.fn(),
    selectCharacterById: vi.fn(),
  };
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('command palette rows', () => {
  it('builds rows without innerHTML or a hand-rolled escaper', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../ui/command-palette.js'), 'utf8');
    expect(src).not.toMatch(/innerHTML/);
    expect(src).not.toMatch(/_escapeHtml/);
  });

  it('renders a hostile entity name as text, injecting no element', () => {
    showCommandPalette(makeUi());
    const input = document.getElementById('cp-input');
    act(() => {
      input.value = 'img';
      input.dispatchEvent(new Event('input'));
    });
    const names = [...document.querySelectorAll('.cp-row__name')].map((n) => n.textContent);
    expect(names).toContain(HOSTILE);
    expect(document.querySelector('#cp-results img')).toBeNull();
  });

  it('keeps quotes and ampersands verbatim', () => {
    showCommandPalette(makeUi());
    const input = document.getElementById('cp-input');
    act(() => {
      input.value = 'obrien';
      input.dispatchEvent(new Event('input'));
    });
    const names = [...document.querySelectorAll('.cp-row__name')].map((n) => n.textContent);
    expect(names).toContain(QUOTED);
  });

  it('keeps the active row in rendered state as the arrows move it', () => {
    showCommandPalette(makeUi());
    const input = document.getElementById('cp-input');
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.querySelector('.cp-row--active').dataset.index).toBe('1');
    expect(document.querySelector('.cp-row--active').getAttribute('aria-selected')).toBe('true');
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); });
    expect(document.querySelector('.cp-row--active').dataset.index).toBe('0');
  });
});
