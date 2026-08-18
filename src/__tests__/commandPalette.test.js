/**
 * Command palette: `/` opens a fuzzy search across every named entity
 * in the campaign. Each result routes to a contextual action when
 * picked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showCommandPalette } from '../ui/command-palette.js';

function makeUi(overrides = {}) {
  return {
    state: {
      tokens:     new Map([['t1', { id: 't1', name: 'Goblin Boss' }]]),
      characters: new Map([['c1', { id: 'c1', name: 'Aragorn' }]]),
      npcs:       new Map(),
      items:      new Map([['i1', { id: 'i1', name: 'Healing Potion' }]]),
      spells:     new Map(),
      handouts:   new Map(),
      pins:       new Map([['p1', { id: 'p1', label: 'Tavern', col: 3, row: 4 }]]),
    },
    mapRenderer: {
      panToToken: vi.fn(),
      setSelectedToken: vi.fn(),
      panTo: vi.fn(),
    },
    previewToken: vi.fn(),
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    showCharacterPreview: vi.fn(),
    showNPCPreview: vi.fn(),
    showItemPreview: vi.fn(),
    showSpellPreview: vi.fn(),
    showHandoutModal: vi.fn(),
    _toast: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('command palette', () => {
  it('opens a modal with an input and an empty-state list', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    expect(document.getElementById('command-palette')).toBeTruthy();
    expect(document.getElementById('cp-input')).toBeTruthy();
  });

  it('shows initial entries (truncated to MAX_RESULTS) before the user types', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const rows = document.querySelectorAll('.cp-row');
    // 1 token + 1 character + 1 item + 1 pin = 4
    expect(rows.length).toBe(4);
  });

  it('filters results as the user types', async () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const input = document.getElementById('cp-input');
    input.value = 'aragorn';
    input.dispatchEvent(new Event('input'));
    const rows = [...document.querySelectorAll('.cp-row__name')].map((r) => r.textContent);
    expect(rows).toContain('Aragorn');
    expect(rows.every((r) => !r.includes('Goblin'))).toBe(true);
  });

  it('Enter on a token result pans the map and opens the preview', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const input = document.getElementById('cp-input');
    input.value = 'goblin';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(ui.mapRenderer.panToToken).toHaveBeenCalledWith('t1');
    expect(ui.previewToken).toHaveBeenCalledWith('t1');
    expect(document.getElementById('command-palette')).toBeNull();
  });

  it('clicking a result also commits the action', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const input = document.getElementById('cp-input');
    input.value = 'goblin';
    input.dispatchEvent(new Event('input'));
    document.querySelector('.cp-row').click();
    expect(ui.mapRenderer.panToToken).toHaveBeenCalledWith('t1');
  });

  it('opens an empty-state palette with an Add Character CTA when the campaign is empty', () => {
    const ui = makeUi({ state: {
      tokens: new Map(), characters: new Map(), npcs: new Map(),
      items: new Map(), spells: new Map(), handouts: new Map(), pins: new Map(),
    }});
    ui.showCharacterWizard = vi.fn();
    showCommandPalette(ui);
    const modal = document.getElementById('command-palette');
    expect(modal).not.toBeNull();
    const cta = modal.querySelector('[data-empty-cta="add-character"]');
    expect(cta?.textContent).toMatch(/Add Character/i);
    cta.click();
    expect(ui.showCharacterWizard).toHaveBeenCalled();
    expect(document.getElementById('command-palette')).toBeNull();
  });

  it('character results select the character into the sidebar sheet', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const input = document.getElementById('cp-input');
    input.value = 'aragorn';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(ui.selectCharacterById).toHaveBeenCalledWith('c1');
    expect(ui.showCharacterPreview).not.toHaveBeenCalled();
  });

  it('arrow keys move the active row', () => {
    const ui = makeUi();
    showCommandPalette(ui);
    const input = document.getElementById('cp-input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const active = document.querySelector('.cp-row--active');
    expect(active.dataset.index).toBe('1');
  });
});
