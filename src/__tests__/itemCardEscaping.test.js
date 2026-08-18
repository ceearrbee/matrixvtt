/**
 * Lock-in tests for the Items.jsx escape contract (TrustedMarkup). Every
 * user-authored field reaching `renderItemCardSections` must pass through
 * `esc()` (or `renderMarkdown`, which emits safe HTML).
 */
import { describe, it, expect } from 'vitest';
import { renderItemCardSections } from '../ui/item-card-sections.js';

describe('renderItemCardSections escape contract', () => {
  it('escapes XSS-shaped damage type on attack line', () => {
    const html = renderItemCardSections(
      { attack_bonus: 3, damage: '1d8', damage_type: '<script>x</script>' },
      [{ kind: 'attack_line' }],
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes XSS-shaped badge values', () => {
    const html = renderItemCardSections(
      { rarity: '"><img src=x>' },
      [{ kind: 'badge', field: 'rarity', color_map: {} }],
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes XSS-shaped stat values', () => {
    const html = renderItemCardSections(
      { weight: '<svg/onload=1>' },
      [{ kind: 'stat_row', stats: [{ field: 'weight', label: 'Weight' }] }],
    );
    expect(html).not.toContain('<svg');
    expect(html).toContain('&lt;svg');
  });
});
