/**
 * Three new item-preview kinds extend the item-card dispatcher with
 * rollable affordances:
 *   - attack_roll    → "🎲 Attack" button (hidden when no attack_bonus)
 *   - damage_roll    → "🎲 Damage" button (hidden when no damage)
 *   - use_consumable → "Use" button (hidden when not consumable)
 *
 * Renderers emit HTML strings with `data-item-action` markers so a
 * single delegated click handler in the preview modal can route them
 * through ui.rollAttack / ui.rollDamage / ui.useConsumable.
 */
import { describe, it, expect } from 'vitest';
import { renderItemCardSections } from '../ui/item-card-sections.js';

describe('item-card kinds: attack_roll / damage_roll / use_consumable', () => {
  it('attack_roll renders a roll button with item id + action', () => {
    const html = renderItemCardSections(
      { id: 'itm-1', attack_bonus: 4, damage: '1d6', damage_type: 'piercing' },
      [{ kind: 'attack_roll' }],
    );
    expect(html).toContain('data-item-action="attack-roll"');
    expect(html).toContain('data-item-id="itm-1"');
    expect(html).toMatch(/Attack/);
  });

  it('attack_roll is hidden when item has no attack_bonus', () => {
    const html = renderItemCardSections(
      { id: 'itm-2', name: 'Cloak' },
      [{ kind: 'attack_roll' }],
    );
    expect(html).toBe('');
  });

  it('damage_roll renders a roll button with the damage formula in data', () => {
    const html = renderItemCardSections(
      { id: 'itm-3', damage: '1d8+3', damage_type: 'slashing' },
      [{ kind: 'damage_roll' }],
    );
    expect(html).toContain('data-item-action="damage-roll"');
    expect(html).toContain('data-damage="1d8+3"');
  });

  it('damage_roll is hidden when item has no damage', () => {
    const html = renderItemCardSections(
      { id: 'itm-4' },
      [{ kind: 'damage_roll' }],
    );
    expect(html).toBe('');
  });

  it('use_consumable renders a Use button when consumable=true', () => {
    const html = renderItemCardSections(
      { id: 'itm-5', name: 'Healing Potion', consumable: true, quantity: 2 },
      [{ kind: 'use_consumable' }],
    );
    expect(html).toContain('data-item-action="use-consumable"');
    expect(html).toContain('data-item-id="itm-5"');
  });

  it('use_consumable hidden when item is not consumable', () => {
    const html = renderItemCardSections(
      { id: 'itm-6', name: 'Sword' },
      [{ kind: 'use_consumable' }],
    );
    expect(html).toBe('');
  });
});
