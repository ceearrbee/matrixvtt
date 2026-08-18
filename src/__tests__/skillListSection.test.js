/**
 * `skill_list` - generic sheet section that renders rows from the
 * ruleset's `skills[]` declaration. Each row is name + bonus,
 * clickable to roll a skill check. Proficiency / expertise dots
 * mirror what the Skills tab already shows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ skills, attributes = [{ key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'wis', label: 'WIS' }] } = {}) {
  return {
    state: {
      canEditEntity: () => true,
      isGM: () => true,
      settings: { systemConfig: { skills, attributes } },
    },
    rollSkillCheck: vi.fn(),
    cycleSkillProficiency: vi.fn(),
    _calcModifier: (score) => Math.floor((Number(score) - 10) / 2),
  };
}

const rulesetSkills = [
  { key: 'athletics',  label: 'Athletics',  attribute: 'str' },
  { key: 'acrobatics', label: 'Acrobatics', attribute: 'dex' },
  { key: 'perception', label: 'Perception', attribute: 'wis' },
];

beforeEach(() => { document.body.innerHTML = ''; });

describe('skill_list section', () => {
  it('renders one row per ruleset-declared skill', () => {
    const ui = makeUi({ skills: rulesetSkills });
    const character = { id: 'c1', attributes: { str: 14, dex: 12, wis: 10 } };
    render(_kindsForTest.skill_list({ ui, character, config: { kind: 'skill_list', label: 'Skills' } }));
    expect(screen.getByText('Athletics')).toBeTruthy();
    expect(screen.getByText('Acrobatics')).toBeTruthy();
    expect(screen.getByText('Perception')).toBeTruthy();
  });

  it('uses an attribute-derived modifier when no override exists', () => {
    const ui = makeUi({ skills: rulesetSkills });
    const character = { id: 'c1', attributes: { str: 14 } };
    const { container } = render(_kindsForTest.skill_list({ ui, character, config: { kind: 'skill_list' } }));
    // STR 14 → +2 modifier
    const athleticsRow = Array.from(container.querySelectorAll('[data-skill-key]'))
      .find((el) => el.getAttribute('data-skill-key') === 'athletics');
    expect(athleticsRow).toBeTruthy();
    expect(athleticsRow.textContent).toMatch(/\+2\b/);
  });

  it('prefers an override bonus from character.skills', () => {
    const ui = makeUi({ skills: rulesetSkills });
    const character = { id: 'c1', attributes: { str: 14 }, skills: { athletics: 7 } };
    const { container } = render(_kindsForTest.skill_list({ ui, character, config: { kind: 'skill_list' } }));
    const athleticsRow = Array.from(container.querySelectorAll('[data-skill-key]'))
      .find((el) => el.getAttribute('data-skill-key') === 'athletics');
    expect(athleticsRow.textContent).toMatch(/\+7\b/);
  });

  it('clicking a skill row rolls that skill', () => {
    const ui = makeUi({ skills: rulesetSkills });
    const character = { id: 'c1', attributes: { str: 14 } };
    render(_kindsForTest.skill_list({ ui, character, config: { kind: 'skill_list' } }));
    fireEvent.click(screen.getByText('Athletics'));
    expect(ui.rollSkillCheck).toHaveBeenCalled();
    const [label, bonus] = ui.rollSkillCheck.mock.calls[0];
    expect(label).toBe('Athletics');
    expect(bonus).toBe(2);
  });

  it('renders nothing useful when the ruleset declares no skills[]', () => {
    const ui = makeUi({ skills: undefined });
    const character = { id: 'c1' };
    const { container } = render(_kindsForTest.skill_list({ ui, character, config: { kind: 'skill_list' } }));
    expect(container.querySelectorAll('[data-skill-key]')).toHaveLength(0);
  });
});
