/**
 * Concentration tracking:
 *  - `getConcentratingSpell(character, spells)` returns the one active concentration spell.
 *  - Spells.jsx highlights the concentration spell with spell-card--concentrating.
 *
 * The damage-time prompt is wired in src/map/actions/combat.js and covered
 * by src/__tests__/concentrationTrigger.test.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { getConcentratingSpell } from '../ui/spells-tab.js';
import { Spells } from '../ui/Spells.jsx';

function makeSpell(overrides = {}) {
  return { name: 'Hold Person', level: 2, school: 'Enchantment', concentration: true, prepared: true, ...overrides };
}

function mountSpells(spellsMap, spellIds) {
  const character = { id: 'c1', name: 'Wizard', spell_ids: spellIds, spell_slots: {} };
  const ui = {
    state: {
      isGM: () => false,
      canEditEntity: () => false,
      getCurrentCharacterId: () => 'c1',
      getCurrentCharacter: () => character,
      getCurrentSpells: () => spellsMap,
      characters: new Map([['c1', character]]),
      spells: spellsMap,
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

describe('getConcentratingSpell', () => {
  it('returns null when character has no spells', () => {
    expect(getConcentratingSpell({ spell_ids: [] }, new Map())).toBeNull();
  });

  it('returns null when no concentration spell is prepared', () => {
    const spells = new Map([['spl-1', makeSpell({ prepared: false })]]);
    expect(getConcentratingSpell({ spell_ids: ['spl-1'] }, spells)).toBeNull();
  });

  it('returns null for cantrips even if concentration flag set', () => {
    const spells = new Map([['spl-1', makeSpell({ level: 0 })]]);
    expect(getConcentratingSpell({ spell_ids: ['spl-1'] }, spells)).toBeNull();
  });

  it('returns null when concentration flag is false', () => {
    const spells = new Map([['spl-1', makeSpell({ concentration: false })]]);
    expect(getConcentratingSpell({ spell_ids: ['spl-1'] }, spells)).toBeNull();
  });

  it('returns the spell entry when one active concentration spell exists', () => {
    const spells = new Map([['spl-1', makeSpell()]]);
    const result = getConcentratingSpell({ spell_ids: ['spl-1'] }, spells);
    expect(result).not.toBeNull();
    expect(result.spell.name).toBe('Hold Person');
    expect(result.id).toBe('spl-1');
  });

  it('returns the first prepared concentration spell when multiple exist', () => {
    const spells = new Map([
      ['spl-1', makeSpell({ name: 'First', prepared: true })],
      ['spl-2', makeSpell({ name: 'Second', prepared: true })],
    ]);
    const result = getConcentratingSpell({ spell_ids: ['spl-1', 'spl-2'] }, spells);
    expect(result.spell.name).toBe('First');
  });
});

describe('<Spells> - concentration highlight', () => {
  it('adds spell-card--concentrating to the active concentration spell', () => {
    const spells = new Map([['spl-1', makeSpell()]]);
    const { container } = mountSpells(spells, ['spl-1']);
    expect(container.querySelector('.spell-card--concentrating')).toBeTruthy();
  });

  it('does NOT add spell-card--concentrating when no spell is concentrating', () => {
    const spells = new Map([['spl-1', makeSpell({ concentration: false })]]);
    const { container } = mountSpells(spells, ['spl-1']);
    expect(container.querySelector('.spell-card--concentrating')).toBeNull();
  });

  it('does NOT highlight a spell that is not the active concentration one', () => {
    const spells = new Map([
      ['spl-1', makeSpell({ name: 'Active', prepared: true })],
      ['spl-2', makeSpell({ name: 'Other',  prepared: true, concentration: false })],
    ]);
    const { container } = mountSpells(spells, ['spl-1', 'spl-2']);
    const highlighted = container.querySelectorAll('.spell-card--concentrating');
    expect(highlighted).toHaveLength(1);
  });
});

