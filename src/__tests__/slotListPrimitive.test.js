/**
 * `slot_list` section primitive - N labeled editable single-line
 * slots, each holds a string. Generalizes FATE consequences, PbtA
 * debilities, WoD damage levels, etc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn() } = {}) {
  return {
    patchEntity,
    state: { canEditEntity: () => true, isGM: () => true, settings: { systemConfig: {} } },
    widgetManager: { userId: '@me:hs' },
  };
}

const consequencesConfig = {
  kind: 'slot_list',
  field: 'consequences',
  label: 'Consequences',
  slots: [
    { key: 'mild',     label: 'Mild (+2)' },
    { key: 'moderate', label: 'Moderate (+4)' },
    { key: 'severe',   label: 'Severe (+6)' },
  ],
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('slot_list', () => {
  it('renders the label and one input per slot', () => {
    const ui = makeUi();
    const character = { id: 'c1' };
    render(_kindsForTest.slot_list({ ui, character, config: consequencesConfig }));
    expect(screen.getByText('Consequences')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mild (+2)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Moderate (+4)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Severe (+6)')).toBeTruthy();
  });

  it('prefills slot inputs from character[field][key]', () => {
    const ui = makeUi();
    const character = { id: 'c1', consequences: { mild: 'Twisted ankle' } };
    render(_kindsForTest.slot_list({ ui, character, config: consequencesConfig }));
    const mild = screen.getByPlaceholderText('Mild (+2)');
    expect(mild.value).toBe('Twisted ankle');
  });

  it('blurring an edited input calls patchEntity with the patched slot map', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1' };
    render(_kindsForTest.slot_list({ ui, character, config: consequencesConfig }));
    const mild = screen.getByPlaceholderText('Mild (+2)');
    fireEvent.input(mild, { target: { value: 'Sprained wrist' } });
    fireEvent.blur(mild);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      consequences: { mild: 'Sprained wrist' },
    });
  });

  it('preserves other slots when one is edited', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', consequences: { severe: 'Maimed' } };
    render(_kindsForTest.slot_list({ ui, character, config: consequencesConfig }));
    const mild = screen.getByPlaceholderText('Mild (+2)');
    fireEvent.input(mild, { target: { value: 'Bruised' } });
    fireEvent.blur(mild);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      consequences: { mild: 'Bruised', severe: 'Maimed' },
    });
  });

  it('does not call patchEntity on blur when the value did not change', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', consequences: { mild: 'A' } };
    render(_kindsForTest.slot_list({ ui, character, config: consequencesConfig }));
    const mild = screen.getByPlaceholderText('Mild (+2)');
    fireEvent.blur(mild);
    expect(patchEntity).not.toHaveBeenCalled();
  });
});
