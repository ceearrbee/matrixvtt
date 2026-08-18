/**
 * `inventory_summary` - sheet section that lists the character's
 * inventory inline. Each row: name, qty (if > 1), kind, click-to-
 * preview. Consumables get a "Use" button that fires the existing
 * consume path. Equippable items get an "Equip" toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ itemMap = new Map() } = {}) {
  return {
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: {} },
      items: itemMap,
    },
    showItemPreview: vi.fn(),
    consumeItem: vi.fn(),
    updateCharacter: vi.fn(),
  };
}

const sword = { id: 'itm-sword', name: 'Shortsword', kind: 'weapon', description: 'Finesse, light.' };
const cloak = { id: 'itm-cloak', name: 'Cloak of Elvenkind', kind: 'wondrous', equippable: true };
const potion = { id: 'itm-potion', name: 'Potion of Healing', kind: 'consumable', quantity: 3, consumable: true };

function itemsMap(...arr) {
  const m = new Map();
  for (const i of arr) m.set(i.id, i);
  return m;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('inventory_summary section', () => {
  it('renders one row per inventory_ids entry, ignoring missing items', () => {
    const ui = makeUi({ itemMap: itemsMap(sword, potion) });
    const character = { id: 'c1', inventory_ids: ['itm-sword', 'itm-potion', 'itm-missing'] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    const rows = document.querySelectorAll('[data-item-id]');
    expect(rows.length).toBe(2);
    expect(screen.getByText('Shortsword')).toBeTruthy();
    expect(screen.getByText('Potion of Healing')).toBeTruthy();
  });

  it('shows quantity badge when an item stacks (qty > 1)', () => {
    const ui = makeUi({ itemMap: itemsMap(potion) });
    const character = { id: 'c1', inventory_ids: ['itm-potion'] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    expect(screen.getByText(/×\s*3/)).toBeTruthy();
  });

  it('clicking the row opens the item preview', () => {
    const ui = makeUi({ itemMap: itemsMap(sword) });
    const character = { id: 'c1', inventory_ids: ['itm-sword'] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    fireEvent.click(screen.getByText('Shortsword'));
    expect(ui.showItemPreview).toHaveBeenCalledWith('itm-sword');
  });

  it('shows a Use button on consumables that fires ui.consumeItem', () => {
    const ui = makeUi({ itemMap: itemsMap(potion) });
    const character = { id: 'c1', inventory_ids: ['itm-potion'] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    const useBtn = screen.getByRole('button', { name: /use potion of healing/i });
    fireEvent.click(useBtn);
    expect(ui.consumeItem).toHaveBeenCalledWith('itm-potion');
  });

  it('non-consumable items have no Use button', () => {
    const ui = makeUi({ itemMap: itemsMap(sword) });
    const character = { id: 'c1', inventory_ids: ['itm-sword'] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    expect(screen.queryByRole('button', { name: /use/i })).toBeNull();
  });

  it('renders the empty state when the character has no inventory', () => {
    const ui = makeUi();
    const character = { id: 'c1', inventory_ids: [] };
    render(_kindsForTest.inventory_summary({ ui, character, config: { kind: 'inventory_summary' } }));
    expect(screen.getByText(/empty|no items/i)).toBeTruthy();
  });
});
