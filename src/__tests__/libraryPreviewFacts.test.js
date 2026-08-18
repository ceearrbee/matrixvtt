import { describe, it, expect } from 'vitest';
import { rulesetFacts, mapFacts, genericFacts } from '../ui/library/preview-facts.js';

describe('rulesetFacts', () => {
  it('summarises meta and content counts', () => {
    const data = {
      system: 'fate',
      name: 'FATE Core',
      version: '1.2',
      author: 'Evil Hat',
      license: 'OGL',
      attributes: [{ key: 'a' }, { key: 'b' }],
      skills: [{ name: 's1' }],
      conditions: [],
    };
    const facts = rulesetFacts(data);
    const byLabel = Object.fromEntries(facts.map((f) => [f.label, f.value]));
    expect(byLabel.System).toBe('fate');
    expect(byLabel.Version).toBe('1.2');
    expect(byLabel.Author).toBe('Evil Hat');
    expect(byLabel.Attributes).toBe('2');
    expect(byLabel.Skills).toBe('1');
    expect(byLabel).not.toHaveProperty('Conditions');
  });

  it('omits missing fields', () => {
    const facts = rulesetFacts({ name: 'Bare' });
    expect(facts.some((f) => f.label === 'Author')).toBe(false);
  });
});

describe('mapFacts', () => {
  it('reports grid dimensions and image presence', () => {
    const facts = mapFacts({ width_cells: 30, height_cells: 20, grid_px: 70, image_url: 'mxc://a/b' });
    const byLabel = Object.fromEntries(facts.map((f) => [f.label, f.value]));
    expect(byLabel.Grid).toBe('30 × 20 cells');
    expect(byLabel['Cell size']).toBe('70px');
    expect(byLabel.Image).toBe('Yes');
  });

  it('marks a gridless / imageless map', () => {
    const byLabel = Object.fromEntries(mapFacts({}).map((f) => [f.label, f.value]));
    expect(byLabel.Image).toBe('No');
  });
});

describe('genericFacts', () => {
  it('lists primitive fields and skips objects, arrays, and empties', () => {
    const facts = genericFacts({
      hp: 7, name: 'Goblin', alive: true, notes: '',
      inventory: ['a'], stats: { str: 3 }, id: 'x',
    });
    const labels = facts.map((f) => f.label);
    expect(labels).toContain('hp');
    expect(labels).toContain('alive');
    expect(labels).not.toContain('inventory');
    expect(labels).not.toContain('stats');
    expect(labels).not.toContain('notes');
    expect(labels).not.toContain('id');
  });
});
