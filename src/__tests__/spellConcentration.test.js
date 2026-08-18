/**
 * Spell concentration / ritual display - Preact edition.
 *
 * The spell form should include Concentration and Ritual checkboxes, and
 * the spell card should display a "Concentration" badge when concentration
 * is true and a "Ritual" badge when ritual is true.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { Spells } from '../ui/Spells.jsx';

function mountWith(spell) {
  const character = {
    id: 'c1', name: 'Wizard', inventory_ids: [],
    spell_ids: ['spl-1'], spell_slots: {},
  };
  const ui = {
    state: {
      isGM: () => false,
      canEditEntity: () => true,
      getCurrentCharacterId: () => 'c1',
      getCurrentCharacter: () => character,
      getCurrentSpells: () => new Map([['spl-1', { id: 'spl-1', ...spell }]]),
      characters: new Map([['c1', character]]),
      spells: new Map([['spl-1', { id: 'spl-1', ...spell }]]),
      settings: { systemConfig: null },
    },
    widgetManager: { userId: '@me:s' },
    toggleSpellPrepared: vi.fn(),
    toggleSpellSlotPip: vi.fn(),
    showSpellForm: vi.fn(),
    deleteSpell: vi.fn(),
    applyLongRest: vi.fn(),
  };
  return render(h(Spells, { ui }));
}

describe('spell concentration/ritual display', () => {
  it('shows a Concentration badge when concentration is true', () => {
    const { container } = mountWith({ name: 'Hold Person', level: 2, concentration: true, ritual: false });
    expect(container.textContent).toContain('Concentration');
  });

  it('shows a Ritual badge when ritual is true', () => {
    const { container } = mountWith({ name: 'Detect Magic', level: 1, concentration: false, ritual: true });
    expect(container.textContent).toContain('Ritual');
  });

  it('shows no badges when both are false', () => {
    const { container } = mountWith({ name: 'Fireball', level: 3, concentration: false, ritual: false });
    expect(container.textContent).not.toContain('Concentration');
    expect(container.textContent).not.toContain('Ritual');
  });

  it('shows Concentration alone when only that flag is set', () => {
    const { container } = mountWith({ name: 'Arcane Eye', level: 4, concentration: true, ritual: false });
    expect(container.textContent).toContain('Concentration');
  });

  it('omits badges when fields are absent (backward compat)', () => {
    const { container } = mountWith({ name: 'Magic Missile', level: 1 });
    expect(container.textContent).not.toContain('Concentration');
    expect(container.textContent).not.toContain('Ritual');
  });
});
