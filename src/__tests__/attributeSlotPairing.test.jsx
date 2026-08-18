/**
 * Systems that pair a slot_list with attributes by key (Risus clichés)
 * surface the slot names on the attribute cards: the card label and
 * the click-to-roll announcement use the character's own name for the
 * slot ("Swashbuckler", not "Cliché 1 dice"), and slots that are both
 * unnamed and at the attribute minimum are hidden. Systems without a
 * paired slot_list (d20) are untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { DynamicAttributes } from '../ui/DynamicAttributes.jsx';
import { pairedSlotField } from '../ui/attribute-pairing.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';

function mount(systemConfig, character, rollAttributeCheck = vi.fn()) {
  const ui = /** @type {any} */ ({
    state: { settings: { systemConfig } },
    rollAttributeCheck,
  });
  return render(h(DynamicAttributes, { ui, attributes: character.attributes || {}, character }));
}

describe('pairedSlotField', () => {
  it('finds the slot_list whose keys match the attributes', () => {
    expect(pairedSlotField(risus)).toBe('cliches');
    expect(pairedSlotField(dnd5e)).toBeNull();
    expect(pairedSlotField(undefined)).toBeNull();
  });
});

describe('DynamicAttributes with paired slots (Risus)', () => {
  const character = {
    cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker' },
    attributes: { cliche1: 4, cliche2: 3, cliche3: 0, cliche4: 0, cliche5: 0, cliche6: 0 },
  };

  it('labels cards with the cliché names', () => {
    const { container } = mount(risus, character);
    const labels = [...container.querySelectorAll('.ab__label')].map((e) => e.textContent);
    expect(labels).toContain('Swashbuckler');
    expect(labels).toContain('Hacker');
  });

  it('hides unnamed slots sitting at the attribute minimum', () => {
    const { container } = mount(risus, character);
    expect(container.querySelectorAll('.ab')).toHaveLength(2);
  });

  it('still shows an unnamed slot that has dice in it', () => {
    const withDice = { ...character, attributes: { ...character.attributes, cliche3: 2 } };
    const { container } = mount(risus, withDice);
    expect(container.querySelectorAll('.ab')).toHaveLength(3);
  });

  it('rolling announces the cliché name', () => {
    const roll = vi.fn();
    const { container } = mount(risus, character, roll);
    fireEvent.click(container.querySelector('.ab'));
    expect(roll).toHaveBeenCalledWith('Swashbuckler', 4);
  });
});

describe('DynamicAttributes without pairing (d20)', () => {
  it('renders every ruleset attribute with its own label', () => {
    const { container } = mount(dnd5e, { attributes: { str: 10 } });
    expect(container.querySelectorAll('.ab')).toHaveLength(dnd5e.attributes.length);
    expect(container.textContent).toContain('Strength');
  });
});
