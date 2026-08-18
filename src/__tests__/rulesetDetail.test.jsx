/**
 * RulesetDetail renders every top-level ruleset section as a collapsible
 * group with readable values, so a GM can inspect a system 1:1.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { RulesetDetail } from '../ui/settings/RulesetDetail.jsx';

afterEach(() => cleanup());

const PRESET = {
  meta: { name: 'Test System' },
  attributes: [{ key: 'str', label: 'Strength' }, { key: 'dex', label: 'Dexterity' }],
  conditions: ['prone', 'poisoned', 'stunned'],
  dice: { sides: 20, count: 1 },
  formulas: { l1: { l2: { l3: { l4: { l5: 'x' } } } } },
};

describe('RulesetDetail', () => {
  it('renders a collapsible section for every top-level key except meta', () => {
    const { container } = render(h(RulesetDetail, { preset: PRESET }));
    expect(container.querySelector('[data-ruleset-detail="meta"]')).toBeNull();
    for (const k of ['attributes', 'conditions', 'dice', 'formulas']) {
      expect(container.querySelector(`[data-ruleset-detail="${k}"]`), k).not.toBeNull();
    }
  });

  it('lists object-array entries and primitive-array entries as chips', () => {
    const { container } = render(h(RulesetDetail, { preset: PRESET }));
    const attrs = container.querySelector('[data-ruleset-detail="attributes"]');
    expect(attrs.textContent).toContain('Strength');
    expect(attrs.textContent).toContain('Dexterity');
    const conds = container.querySelector('[data-ruleset-detail="conditions"]');
    expect(conds.querySelectorAll('.rs-chip').length).toBe(3);
  });

  it('renders empty values as the word none, not a dash glyph', () => {
    const { container } = render(h(RulesetDetail, { preset: { ...PRESET, spellcasting: null } }));
    const section = container.querySelector('[data-ruleset-detail="spellcasting"]');
    expect(section.textContent).toContain('none');
    expect(container.textContent).not.toContain('\u2014');
  });

  it('falls back to JSON for deeply nested structures', () => {
    const { container } = render(h(RulesetDetail, { preset: PRESET }));
    const formulas = container.querySelector('[data-ruleset-detail="formulas"]');
    expect(formulas.querySelector('.rs-json')).not.toBeNull();
  });
});
