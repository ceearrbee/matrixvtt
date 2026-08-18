/**
 * GMItemsView - GM-only Items tab branch.
 *
 * Shows every item in the campaign, filtered by location:
 *   - "On character": items in some PC's inventory_ids, badged with the
 *     PC name.
 *   - "Available / on map": items NOT held by any PC; badge reads
 *     "on map" if a type:'item' token references them, else "loose".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { Items } from '../ui/Items.jsx';
import { itemsSignal, charactersSignal, tokensSignal } from '../state/signals.js';

function makeUi({ items = {}, characters = {}, tokens = {}, isGM = true } = {}) {
  return {
    state: {
      isGM: () => isGM,
      items: new Map(Object.entries(items)),
      characters: new Map(Object.entries(characters)),
      tokens: new Map(Object.entries(tokens)),
      settings: { systemConfig: {} },
      getCurrentCharacter: () => null,
      canEditEntity: () => true,
    },
    showItemPreview: vi.fn(),
    showItemForm: vi.fn(),
    selectCharacterById: vi.fn(),
  };
}

function setSignals(ui) {
  itemsSignal.value = new Map(ui.state.items);
  charactersSignal.value = new Map(ui.state.characters);
  tokensSignal.value = new Map(ui.state.tokens);
}

describe('GMItemsView', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    itemsSignal.value = new Map();
    charactersSignal.value = new Map();
    tokensSignal.value = new Map();
  });

  it('GM sees the "On character" filter by default with one card per held item', () => {
    const ui = makeUi({
      items: {
        'itm-a': { name: 'Apple' },
        'itm-b': { name: 'Boot' },
        'itm-c': { name: 'Cloak' },
      },
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-a', 'itm-b'] } },
    });
    setSignals(ui);
    render(h(Items, { ui }), host);

    const cards = host.querySelectorAll('.item-card');
    expect(cards.length).toBe(2);
    const txt = host.textContent;
    expect(txt).toContain('Apple');
    expect(txt).toContain('Boot');
    expect(txt).not.toContain('Cloak');
    // Holder badge naming the PC.
    expect(host.querySelector('[data-item-holder="chr-1"]')).toBeTruthy();
    expect(host.textContent).toMatch(/Aria/);
  });

  it('switching to "Available / on map" shows loose and on-map items, with correct badges', async () => {
    const ui = makeUi({
      items: {
        'itm-a': { name: 'Apple' }, // held
        'itm-b': { name: 'Boot' }, // on map
        'itm-c': { name: 'Cloak' }, // loose
      },
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-a'] } },
      tokens: { 'tok-x': { id: 'tok-x', type: 'item', item_id: 'itm-b' } },
    });
    setSignals(ui);
    render(h(Items, { ui }), host);

    // Click the "Available / on map" filter button.
    const btn = host.querySelector('[data-items-filter="available"]');
    expect(btn).toBeTruthy();
    btn.click();
    await new Promise(r => setTimeout(r, 0));

    const txt = host.textContent;
    expect(txt).toContain('Boot');
    expect(txt).toContain('Cloak');
    expect(txt).not.toContain('Apple');

    expect(host.querySelector('[data-item-location="on-map"]')).toBeTruthy();
    expect(host.querySelector('[data-item-location="loose"]')).toBeTruthy();
  });

  it('renders empty state when no items match the current filter', () => {
    const ui = makeUi({ items: { 'itm-a': { name: 'Apple' } } });
    setSignals(ui);
    // Apple is loose by default; "On character" filter should be empty.
    render(h(Items, { ui }), host);
    expect(host.querySelector('.item-card')).toBeNull();
    expect(host.textContent.toLowerCase()).toMatch(/no items/);
  });

  it('non-GM still sees the original character-scoped view (no filter strip)', () => {
    const ui = makeUi({
      items: { 'itm-a': { name: 'Apple' } },
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-a'] } },
      isGM: false,
    });
    ui.state.getCurrentCharacter = () => ui.state.characters.get('chr-1');
    setSignals(ui);
    render(h(Items, { ui }), host);

    expect(host.querySelector('[data-items-filter]')).toBeNull();
    expect(host.textContent).toContain('Apple');
  });
});
