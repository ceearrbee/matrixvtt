/**
 * $sum_items evaluator op - aggregates a field across `context.inventory`
 * with optional filter + multiplier fields.
 *
 *   $sum_items(field)
 *     → Σ item[field] for every item in context.inventory
 *
 *   $sum_items(field, filterField)
 *     → Σ item[field] where item[filterField] is truthy
 *
 *   $sum_items(field, filterField | null, multiplyField)
 *     → Σ (item[field] * item[multiplyField]) with optional filter
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../engine/evaluate.js';

const inventory = [
  { id: 'a', name: 'Shield',        ac_bonus: 2, equipped: true,  weight: 6,  cost_gp: 10, quantity: 1 },
  { id: 'b', name: 'Plate Armor',   ac_bonus: 6, equipped: true,  weight: 65, cost_gp: 1500, quantity: 1 },
  { id: 'c', name: 'Spare Shield',  ac_bonus: 2, equipped: false, weight: 6,  cost_gp: 10, quantity: 2 },
  { id: 'd', name: 'Torches',                                     weight: 1,  cost_gp: 1,   quantity: 5 },
];

describe('$sum_items', () => {
  it('sums a field across all items', () => {
    expect(evaluate({ $: 'sum_items', args: ['ac_bonus'] }, { inventory })).toBe(10);
  });

  it('filter limits to items where filterField is truthy', () => {
    expect(evaluate({ $: 'sum_items', args: ['ac_bonus', 'equipped'] }, { inventory })).toBe(8);
  });

  it('multiplyField multiplies per item before summing', () => {
    expect(evaluate({ $: 'sum_items', args: ['cost_gp', null, 'quantity'] }, { inventory }))
      .toBe(10 + 1500 + 20 + 5);
  });

  it('filter + multiply combine', () => {
    // equipped items, cost × quantity: 10*1 + 1500*1 = 1510
    expect(evaluate({ $: 'sum_items', args: ['cost_gp', 'equipped', 'quantity'] }, { inventory }))
      .toBe(1510);
  });

  it('missing field defaults to 0 per item', () => {
    expect(evaluate({ $: 'sum_items', args: ['ghost_field'] }, { inventory })).toBe(0);
  });

  it('missing multiply field defaults to 1 (not 0 - otherwise unpriced items erase the sum)', () => {
    // "Torches" has quantity 5 but we sum by "weight" alone with multiplier "quantity" missing
    // Here we use an explicit case: item without multiplier field counts once.
    const partial = [{ weight: 5 }, { weight: 3, quantity: 2 }];
    expect(evaluate({ $: 'sum_items', args: ['weight', null, 'quantity'] }, { inventory: partial }))
      .toBe(5 + 6);
  });

  it('empty or missing inventory returns 0', () => {
    expect(evaluate({ $: 'sum_items', args: ['ac_bonus'] }, {})).toBe(0);
    expect(evaluate({ $: 'sum_items', args: ['ac_bonus'] }, { inventory: [] })).toBe(0);
  });

  it('composes inside larger formulas', () => {
    const formula = {
      $: '+',
      args: [10, { $: 'sum_items', args: ['ac_bonus', 'equipped'] }],
    };
    expect(evaluate(formula, { inventory })).toBe(18);
  });
});
