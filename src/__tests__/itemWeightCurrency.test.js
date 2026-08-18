/**
 * Item weight and currency fields - Preact <Items> tab.
 *
 * Items should display weight (lb) and cost (gp) when those fields are
 * set via the ruleset's `item_card.sections.stat_row` config.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { Items } from '../ui/Items.jsx';

function mountItems(item) {
  const character = { id: 'c1', name: 'Hero', inventory_ids: ['itm-1'] };
  const ui = {
    state: {
      isGM: () => true,
      canEditEntity: () => true,
      getCurrentCharacterId: () => 'c1',
      getCurrentCharacter: () => character,
      characters: new Map([['c1', character]]),
      items: new Map([['itm-1', { id: 'itm-1', ...item }]]),
      settings: {
        systemConfig: {
          item_card: { sections: [{
            kind: 'stat_row',
            stats: [
              { field: 'weight', unit: 'lb' },
              { field: 'cost_gp', unit: 'gp' },
            ],
          }] },
        },
      },
    },
    widgetManager: { userId: '@me:s' },
    showItemForm: vi.fn(),
    showEditItemForm: vi.fn(),
    deleteItem: vi.fn(),
    toggleEquipItem: vi.fn(),
  };
  return render(h(Items, { ui }));
}

describe('item weight and currency display', () => {
  it('displays weight when set', () => {
    const { container } = mountItems({ name: 'Chain Mail', type: 'Armor', weight: 55, cost_gp: 75 });
    expect(container.textContent).toContain('55');
    expect(container.textContent.toLowerCase()).toMatch(/lb|weight/);
  });

  it('displays cost in gp when set', () => {
    const { container } = mountItems({ name: 'Longsword', type: 'Weapon', weight: 3, cost_gp: 15 });
    expect(container.textContent).toContain('15');
    expect(container.textContent.toLowerCase()).toMatch(/gp|gold/);
  });

  it('omits weight when not set (backward compat)', () => {
    const { container } = mountItems({ name: 'Dagger', type: 'Weapon' });
    expect(container.textContent).not.toMatch(/\blb\b/);
  });

  it('omits cost when not set (backward compat)', () => {
    const { container } = mountItems({ name: 'Dagger', type: 'Weapon' });
    expect(container.textContent).not.toMatch(/\bgp\b/);
  });
});
