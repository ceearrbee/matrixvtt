/**
 * `currency` - generic sheet section showing per-denomination integer
 * pools (gp, sp, cp; or whatever the ruleset declares). Editable
 * cells; ruleset declares denominations so a non-D&D system can use
 * the same primitive for credits, marks, blood, etc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ denominations, canEdit = true } = {}) {
  return {
    state: {
      canEditEntity: () => canEdit,
      isGM: () => true,
      settings: { systemConfig: { currency: { denominations } } },
    },
    patchEntity: vi.fn(),
  };
}

const dnd5eCurrency = [
  { key: 'cp', label: 'Copper' },
  { key: 'sp', label: 'Silver' },
  { key: 'gp', label: 'Gold' },
  { key: 'pp', label: 'Platinum' },
];

beforeEach(() => { document.body.innerHTML = ''; });

describe('currency section', () => {
  it('renders one input per ruleset-declared denomination', () => {
    const ui = makeUi({ denominations: dnd5eCurrency });
    const character = { id: 'c1', currency: { gp: 50, sp: 12 } };
    render(_kindsForTest.currency({ ui, character, config: { kind: 'currency', label: 'Coinage' } }));
    expect(screen.getByLabelText('Copper').value).toBe('0');
    expect(screen.getByLabelText('Silver').value).toBe('12');
    expect(screen.getByLabelText('Gold').value).toBe('50');
    expect(screen.getByLabelText('Platinum').value).toBe('0');
  });

  it('blurring an edited input saves the new value', () => {
    const patchEntity = vi.fn();
    const ui = { ...makeUi({ denominations: dnd5eCurrency }), patchEntity };
    ui.state = { ...ui.state, settings: { systemConfig: { currency: { denominations: dnd5eCurrency } } } };
    const character = { id: 'c1', currency: { gp: 50 } };
    render(_kindsForTest.currency({ ui, character, config: { kind: 'currency' } }));
    const goldInput = screen.getByLabelText('Gold');
    fireEvent.input(goldInput, { target: { value: '75' } });
    fireEvent.blur(goldInput);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      currency: { gp: 75 },
    });
  });

  it('preserves other denominations when one is edited', () => {
    const patchEntity = vi.fn();
    const ui = { ...makeUi({ denominations: dnd5eCurrency }), patchEntity };
    ui.state = { ...ui.state, settings: { systemConfig: { currency: { denominations: dnd5eCurrency } } } };
    const character = { id: 'c1', currency: { gp: 50, sp: 12, cp: 5 } };
    render(_kindsForTest.currency({ ui, character, config: { kind: 'currency' } }));
    const silverInput = screen.getByLabelText('Silver');
    fireEvent.input(silverInput, { target: { value: '20' } });
    fireEvent.blur(silverInput);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      currency: { gp: 50, sp: 20, cp: 5 },
    });
  });

  it('inputs are readonly when the viewer cannot edit', () => {
    const ui = makeUi({ denominations: dnd5eCurrency, canEdit: false });
    const character = { id: 'c1', currency: { gp: 50 } };
    render(_kindsForTest.currency({ ui, character, config: { kind: 'currency' } }));
    expect(screen.getByLabelText('Gold').readOnly).toBe(true);
  });

  it('renders nothing useful when the ruleset declares no denominations', () => {
    const ui = makeUi({ denominations: undefined });
    const character = { id: 'c1' };
    const { container } = render(_kindsForTest.currency({ ui, character, config: { kind: 'currency' } }));
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });
});

describe('character schema - new optional narrative-identity fields', () => {
  it('accepts currency / alignment / background / ideals / bonds / flaws on a character', async () => {
    const { validateCharacter } = await import('../utils/schemas/actors.js');
    expect(validateCharacter({
      id: 'c1', name: 'A', type: 'pc',
      currency: { gp: 50, sp: 12 },
      alignment: 'Chaotic Good',
      background: 'Folk Hero',
      ideals: 'Freedom for all.',
      bonds: 'I owe my mentor everything.',
      flaws: 'I never back down from a fight.',
    })).toBe(true);
  });

  it('rejects currency that is not a Record<string, number>', async () => {
    const { validateCharacter } = await import('../utils/schemas/actors.js');
    expect(() => validateCharacter({
      id: 'c1', name: 'A', type: 'pc',
      currency: { gp: 'lots' },
    })).toThrow(/currency/);
  });

  it('rejects non-string alignment / background / ideals', async () => {
    const { validateCharacter } = await import('../utils/schemas/actors.js');
    expect(() => validateCharacter({
      id: 'c1', name: 'A', type: 'pc', alignment: 42,
    })).toThrow(/alignment/);
  });
});
