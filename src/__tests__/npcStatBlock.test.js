/**
 * NPC monster stat-block extended fields.
 *
 * collectNPCExtendedFields(modal) reads the extended DOM fields from the
 * NPC form and returns a plain object with the new stat-block fields:
 *   senses, languages, alignment, creature_type, multiattack,
 *   damage_resistances, damage_immunities, condition_immunities,
 *   special_abilities, legendary_actions, reactions
 */

import { describe, it, expect } from 'vitest';
import { collectNPCExtendedFields } from '../ui/entity-forms.js';

function makeNPCModal(overrides = {}) {
  const data = {
    'npc-senses': 'Darkvision 60 ft., passive Perception 12',
    'npc-languages': 'Common, Goblin',
    'npc-alignment': 'Neutral Evil',
    'npc-creature-type': 'Humanoid',
    'npc-multiattack': 'The goblin makes two attacks with its scimitar.',
    'npc-damage-resistances': 'bludgeoning from non-magical weapons',
    'npc-damage-immunities': 'poison',
    'npc-condition-immunities': 'frightened',
    ...overrides,
  };
  const el = document.createElement('div');
  for (const [id, value] of Object.entries(data)) {
    const input = document.createElement(value.includes('\n') ? 'textarea' : 'input');
    input.id = id;
    input.value = value;
    el.appendChild(input);
  }
  return el;
}

describe('collectNPCExtendedFields', () => {
  it('reads senses and languages', () => {
    const result = collectNPCExtendedFields(makeNPCModal());
    expect(result.senses).toBe('Darkvision 60 ft., passive Perception 12');
    expect(result.languages).toBe('Common, Goblin');
  });

  it('reads alignment and creature type', () => {
    const result = collectNPCExtendedFields(makeNPCModal());
    expect(result.alignment).toBe('Neutral Evil');
    expect(result.creature_type).toBe('Humanoid');
  });

  it('reads multiattack description', () => {
    const result = collectNPCExtendedFields(makeNPCModal());
    expect(result.multiattack).toBe('The goblin makes two attacks with its scimitar.');
  });

  it('reads damage resistances, immunities, and condition immunities', () => {
    const result = collectNPCExtendedFields(makeNPCModal());
    expect(result.damage_resistances).toBe('bludgeoning from non-magical weapons');
    expect(result.damage_immunities).toBe('poison');
    expect(result.condition_immunities).toBe('frightened');
  });

  it('returns empty strings when fields are absent', () => {
    const emptyModal = document.createElement('div');
    const result = collectNPCExtendedFields(emptyModal);
    expect(result.senses).toBe('');
    expect(result.legendary_actions_count).toBe(0);
  });
});
