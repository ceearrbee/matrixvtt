/**
 * Currency aggregation - a character's coin holdings sum to a total
 * value (in the ruleset's base denomination) and a total weight, using
 * the ruleset's `currency.denominations[]` table (SRD: cp/sp/ep/gp/pp,
 * 50 coins per pound).
 */
import { describe, it, expect } from 'vitest';
import { computeCurrencyTotals } from '../engine/currency.js';

const dnd5eCurrency = {
  denominations: [
    { key: 'cp', label: 'Copper', value_in_base: 1, weight: 0.02 },
    { key: 'sp', label: 'Silver', value_in_base: 10, weight: 0.02 },
    { key: 'ep', label: 'Electrum', value_in_base: 50, weight: 0.02 },
    { key: 'gp', label: 'Gold', value_in_base: 100, weight: 0.02 },
    { key: 'pp', label: 'Platinum', value_in_base: 1000, weight: 0.02 },
  ],
};

describe('computeCurrencyTotals', () => {
  it('converts mixed denominations into a total base value', () => {
    const totals = computeCurrencyTotals({ gp: 50, sp: 12, cp: 5 }, dnd5eCurrency);
    expect(totals.totalValueInBase).toBe(50 * 100 + 12 * 10 + 5 * 1);
  });

  it('aggregates coin weight at 50 coins per pound', () => {
    const totals = computeCurrencyTotals({ gp: 50, sp: 12, cp: 5 }, dnd5eCurrency);
    expect(totals.totalWeight).toBeCloseTo((50 + 12 + 5) * 0.02, 5);
  });

  it('treats missing holdings as an empty pool', () => {
    const totals = computeCurrencyTotals(undefined, dnd5eCurrency);
    expect(totals).toEqual({ totalValueInBase: 0, totalWeight: 0 });
  });

  it('treats zero holdings as zero totals', () => {
    const totals = computeCurrencyTotals({ gp: 0, sp: 0 }, dnd5eCurrency);
    expect(totals).toEqual({ totalValueInBase: 0, totalWeight: 0 });
  });

  it('ignores denominations not declared by the ruleset', () => {
    const totals = computeCurrencyTotals({ gp: 1, credits: 999 }, dnd5eCurrency);
    expect(totals.totalValueInBase).toBe(100);
  });

  it('returns null when the ruleset defines no currency table', () => {
    expect(computeCurrencyTotals({ gp: 50 }, undefined)).toBeNull();
    expect(computeCurrencyTotals({ gp: 50 }, { denominations: [] })).toBeNull();
  });
});
