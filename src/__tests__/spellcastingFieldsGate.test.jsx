/**
 * The Spellcasting form section follows the same rule as the Spells
 * tab: present only when the ruleset declares spell_schools. Systems
 * without magic must not offer a spellcasting ability and L1-L9 slots.
 */
import { describe, it, expect } from 'vitest';
import { render, h } from 'preact';
import { SpellcastingFields } from '../ui/entity-form/SpellcastingFields.jsx';

function mount(systemConfig) {
  const ui = { state: { settings: { systemConfig } } };
  const host = document.createElement('div');
  render(h(SpellcastingFields, { ui, entity: null, isPC: true, isEdit: false }), host);
  return host;
}

describe('SpellcastingFields', () => {
  it('renders nothing for systems without spell_schools (Risus, FATE)', () => {
    expect(mount({ attributes: [{ key: 'cliche1', label: 'Cliché 1 dice' }] }).textContent).toBe('');
  });

  it('renders for systems that declare spell_schools', () => {
    const host = mount({
      attributes: [{ key: 'intelligence', label: 'Intelligence' }],
      spell_schools: [{ key: 'evocation', label: 'Evocation' }],
    });
    expect(host.textContent).toContain('Spellcasting');
  });
});
