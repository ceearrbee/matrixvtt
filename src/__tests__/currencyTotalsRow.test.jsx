/**
 * `computeCurrencyTotals` shipped with Track 4G and had no caller, so a
 * purse showed five editable counts and never what they were worth or
 * what they weighed. The totals row is that module's reader.
 *
 * The labelled stat grid is what lets a ruleset put a second grid on a
 * sheet without the two running together.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { Currency } from '../ui/character-sheet-sections/lists.js';
import { StatGrid } from '../ui/character-sheet-sections/display.js';

const DENOMINATIONS = [
  { key: 'cp', label: 'Copper', value_in_base: 1, weight: 0.02 },
  { key: 'gp', label: 'Gold', value_in_base: 100, weight: 0.02 },
];

function uiWith(denominations) {
  return {
    state: {
      settings: { systemConfig: { currency: denominations && { denominations } } },
      items: new Map(),
      canEditEntity: () => true,
    },
  };
}

describe('the coin section reports what the purse is worth', () => {
  it('totals value in the base denomination and the weight carried', () => {
    const character = { id: 'c1', name: 'Vex', currency: { cp: 30, gp: 4 } };
    const { container } = render(
      h(Currency, { ui: uiWith(DENOMINATIONS), character, config: { label: 'Coinage' } }),
    );

    const totals = container.querySelector('.currency-totals');
    expect(totals).not.toBeNull();
    expect(totals.textContent).toContain('430 cp');
    expect(totals.textContent).toContain('0.68 weight');
  });

  it('says nothing about totals when the ruleset declares no coins', () => {
    const character = { id: 'c1', name: 'Vex' };
    const { container } = render(
      h(Currency, { ui: uiWith(null), character, config: { label: 'Coinage' } }),
    );
    expect(container.querySelector('.currency-totals')).toBeNull();
  });
});

describe('a stat grid can carry a heading', () => {
  const ui = {
    state: { settings: { systemConfig: {} }, items: new Map(), canEditEntity: () => true },
  };
  const character = { id: 'c1', name: 'Vex', speed: 30 };

  it('renders the label above the tiles when the ruleset names one', () => {
    const { container } = render(h(StatGrid, {
      ui, character,
      config: { label: 'Load and Wealth', stats: [{ label: 'Speed', field: 'speed' }] },
    }));
    expect(container.querySelector('.section-header').textContent).toBe('Load and Wealth');
  });

  it('renders no heading when the ruleset names none', () => {
    const { container } = render(h(StatGrid, {
      ui, character, config: { stats: [{ label: 'Speed', field: 'speed' }] },
    }));
    expect(container.querySelector('.section-header')).toBeNull();
  });
});
