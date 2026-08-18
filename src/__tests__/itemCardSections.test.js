/**
 * F1: item card body composed from `ruleset.item_card.sections[]`.
 * Kinds: badge, stat_row, attack_line, description.
 * Unknown kinds silently skip (forward compat).
 *
 * Returns HTML strings (items-tab.js is pre-JSX template-string UI).
 */

import { describe, it, expect } from 'vitest';
import { renderItemCardSections } from '../ui/item-card-sections.js';

const d5e = {
  item_card: {
    sections: [
      { kind: 'badge', field: 'rarity', color_map: {
        common: '#888', uncommon: '#6c6', rare: '#6af',
        'very rare': '#f93', legendary: '#f43',
      }},
      { kind: 'attack_line' },
      { kind: 'description' },
      { kind: 'stat_row', stats: [
        { label: '', field: 'weight', unit: 'lb' },
        { label: '', field: 'cost_gp', unit: 'gp' },
      ]},
    ],
  },
};

describe('renderItemCardSections', () => {
  it('empty sections → empty string', () => {
    expect(renderItemCardSections({}, [])).toBe('');
    expect(renderItemCardSections({}, undefined)).toBe('');
  });

  it('unknown kinds silently skip', () => {
    expect(renderItemCardSections({ rarity: 'common' }, [{ kind: 'mystery' }]))
      .toBe('');
  });

  it('badge renders rarity chip with color from map', () => {
    const html = renderItemCardSections({ rarity: 'rare' },
      [{ kind: 'badge', field: 'rarity', color_map: d5e.item_card.sections[0].color_map }]);
    expect(html).toContain('rare');
    expect(html).toContain('#6af');
  });

  it('badge with missing field renders nothing', () => {
    const html = renderItemCardSections({},
      [{ kind: 'badge', field: 'rarity' }]);
    expect(html).toBe('');
  });

  it('attack_line renders bonus + damage + type when all present', () => {
    const html = renderItemCardSections(
      { attack_bonus: 3, damage: '1d8', damage_type: 'slashing' },
      [{ kind: 'attack_line' }]);
    expect(html).toMatch(/\+3 hit/);
    expect(html).toContain('1d8');
    expect(html).toContain('slashing');
  });

  it('attack_line skipped when no attack_bonus', () => {
    expect(renderItemCardSections({ damage: '1d6' }, [{ kind: 'attack_line' }])).toBe('');
  });

  it('description runs value through markdown escaping', () => {
    const html = renderItemCardSections({ description: 'A **sharp** sword' },
      [{ kind: 'description' }]);
    expect(html).toContain('sharp');
  });

  it('stat_row omits missing values gracefully', () => {
    const sections = [{ kind: 'stat_row', stats: [
      { field: 'weight', unit: 'lb' },
      { field: 'cost_gp', unit: 'gp' },
    ]}];
    const html = renderItemCardSections({ weight: 6 }, sections);
    expect(html).toContain('6 lb');
    expect(html).not.toContain('gp');
  });

  it('stat_row with label shows "Label: value unit"', () => {
    const sections = [{ kind: 'stat_row', stats: [{ label: 'Weight', field: 'weight', unit: 'lb' }] }];
    const html = renderItemCardSections({ weight: 3 }, sections);
    expect(html).toMatch(/Weight.*3 lb/);
  });

  it('composes multiple sections in order', () => {
    const html = renderItemCardSections(
      { rarity: 'rare', description: 'Glows faintly', weight: 2 },
      [
        { kind: 'badge', field: 'rarity', color_map: { rare: '#6af' } },
        { kind: 'description' },
        { kind: 'stat_row', stats: [{ field: 'weight', unit: 'lb' }] },
      ]);
    const rareIdx = html.indexOf('rare');
    const descIdx = html.indexOf('Glows');
    const weightIdx = html.indexOf('2 lb');
    expect(rareIdx).toBeLessThan(descIdx);
    expect(descIdx).toBeLessThan(weightIdx);
  });
});
