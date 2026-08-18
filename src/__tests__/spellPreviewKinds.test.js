/**
 * Spell-preview section kinds, parallel to item-card kinds:
 *   - spell_meta         → level + school + casting time line
 *   - cast_spell         → "🪄 Cast" button (data-spell-action="cast")
 *   - spell_damage_roll  → "🎲 Damage" button (hidden if no damage)
 *   - spell_save_roll    → "Save DC" announce button (hidden if no save)
 *   - description / higher_level → markdown text blocks
 */
import { describe, it, expect } from 'vitest';
import { renderSpellPreviewSections } from '../ui/spell-preview-sections.js';

describe('spell-preview kinds', () => {
  it('cast_spell renders a button with data-spell-action="cast"', () => {
    const html = renderSpellPreviewSections(
      { id: 'sp-fb', name: 'Fireball', level: 3 },
      [{ kind: 'cast_spell' }],
    );
    expect(html).toContain('data-spell-action="cast"');
    expect(html).toContain('data-spell-id="sp-fb"');
    expect(html).toMatch(/Cast/);
  });

  it('spell_damage_roll renders only when spell has damage', () => {
    const withDamage = renderSpellPreviewSections(
      { id: 'sp-fb', damage: '8d6', damage_type: 'fire' },
      [{ kind: 'spell_damage_roll' }],
    );
    expect(withDamage).toContain('data-spell-action="damage"');
    expect(withDamage).toContain('data-damage="8d6"');

    const noDamage = renderSpellPreviewSections(
      { id: 'sp-bless' },
      [{ kind: 'spell_damage_roll' }],
    );
    expect(noDamage).toBe('');
  });

  it('spell_save_roll renders only when spell has save_ability', () => {
    const withSave = renderSpellPreviewSections(
      { id: 'sp-fb', save_ability: 'dex' },
      [{ kind: 'spell_save_roll' }],
    );
    expect(withSave).toContain('data-spell-action="save"');
    expect(withSave).toMatch(/DEX/);

    const noSave = renderSpellPreviewSections(
      { id: 'sp-magic-missile' },
      [{ kind: 'spell_save_roll' }],
    );
    expect(noSave).toBe('');
  });

  it('spell_meta builds a level + school + casting-time line', () => {
    const html = renderSpellPreviewSections(
      { level: 3, school: 'Evocation', casting_time: '1 action' },
      [{ kind: 'spell_meta' }],
    );
    expect(html).toMatch(/3rd-level Evocation/);
    expect(html).toMatch(/1 action/);
  });

  it('description renders markdown', () => {
    const html = renderSpellPreviewSections(
      { description: '**Bright** flash of fire.' },
      [{ kind: 'description' }],
    );
    expect(html).toContain('<strong>Bright</strong>');
  });

  it('higher_level renders only when present', () => {
    expect(renderSpellPreviewSections(
      { higher_level: 'Add 1d6 per slot above 3rd.' },
      [{ kind: 'higher_level' }],
    )).toMatch(/per slot above 3rd/);

    expect(renderSpellPreviewSections({}, [{ kind: 'higher_level' }])).toBe('');
  });
});
