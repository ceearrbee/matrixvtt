/**
 * sortInitiativeOrder - initiative tie-breaking
 *
 * Entries with equal initiative values are ordered by DEX modifier
 * (highest first).
 */

import { describe, it, expect, vi } from 'vitest';
import { sortInitiativeOrder } from '../ui/combat-manager.js';

function makeMockUI(characterData = {}) {
  return {
    state: {
      characters: { get: (id) => characterData[id] ?? null },
      npcs: { get: () => null },
      settings: { systemConfig: { initiative: { tie_break_stat: 'dex' } } },
    },
  };
}

function entry(name, initiative, dex = 10) {
  return { name, initiative, token_id: name, character_id: name, _dex: dex };
}

describe('sortInitiativeOrder - tie-breaking by DEX modifier', () => {
  it('sorts by initiative descending when no ties', () => {
    const order = [entry('B', 12), entry('A', 18), entry('C', 5)];
    const ui = makeMockUI();
    sortInitiativeOrder(ui, order);
    expect(order.map(e => e.name)).toEqual(['A', 'B', 'C']);
  });

  it('breaks ties by DEX modifier (higher DEX goes first)', () => {
    // Both rolled 15; Fighter has DEX 16 (+3), Wizard has DEX 8 (-1)
    const order = [entry('Wizard', 15, 8), entry('Fighter', 15, 16)];
    const ui = makeMockUI({
      'Wizard': { attributes: { dex: 8 } },
      'Fighter': { attributes: { dex: 16 } }
    });
    sortInitiativeOrder(ui, order);
    expect(order[0].name).toBe('Fighter');
    expect(order[1].name).toBe('Wizard');
  });

  it('keeps insertion order when initiative AND dex modifier are equal', () => {
    const order = [entry('A', 10, 10), entry('B', 10, 10), entry('C', 10, 10)];
    const ui = makeMockUI({
      'A': { attributes: { dex: 10 } },
      'B': { attributes: { dex: 10 } },
      'C': { attributes: { dex: 10 } }
    });
    sortInitiativeOrder(ui, order);
    expect(order.map(e => e.name)).toEqual(['A', 'B', 'C']);
  });

  it('correctly interleaves tied and untied entries', () => {
    const order = [
      entry('X', 20),
      entry('LowDex', 15, 6),
      entry('HighDex', 15, 18),
      entry('Y', 10),
    ];
    const ui = makeMockUI({
      'X': { attributes: { dex: 10 } },
      'LowDex': { attributes: { dex: 6 } },
      'HighDex': { attributes: { dex: 18 } },
      'Y': { attributes: { dex: 10 } }
    });
    sortInitiativeOrder(ui, order);
    expect(order.map(e => e.name)).toEqual(['X', 'HighDex', 'LowDex', 'Y']);
  });

  it('mutates the array in-place and returns it', () => {
    const order = [entry('B', 5), entry('A', 10)];
    const ui = makeMockUI({
      'A': { attributes: { dex: 10 } },
      'B': { attributes: { dex: 10 } }
    });
    const result = sortInitiativeOrder(ui, order);
    expect(result).toBe(order);
    expect(order[0].name).toBe('A');
  });
});
