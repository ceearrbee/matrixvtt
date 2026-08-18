/**
 * `pending_modifiers_list` - sheet section that shows the queued
 * pending_modifiers stack with a Cancel button per entry. Closes the
 * "did I really queue that?" gap the invoke path opens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn() } = {}) {
  return {
    patchEntity,
    state: { canEditEntity: () => true, isGM: () => true, settings: { systemConfig: {} } },
    widgetManager: { userId: '@me:hs' },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

const config = { kind: 'pending_modifiers_list', label: 'Pending bonuses' };

describe('pending_modifiers_list', () => {
  it('renders nothing when the stack is empty', () => {
    const ui = makeUi();
    const character = { id: 'c1' };
    const result = _kindsForTest.pending_modifiers_list({ ui, character, config });
    expect(result).toBeFalsy();
  });

  it('renders one row per pending entry with value and source', () => {
    const ui = makeUi();
    const character = { id: 'c1', pending_modifiers: [
      { value: 2, source: 'Trouble follows me' },
      { value: -1, source: 'Distracted' },
    ]};
    render(_kindsForTest.pending_modifiers_list({ ui, character, config }));
    expect(screen.getByText(/trouble follows me/i)).toBeTruthy();
    expect(screen.getByText(/distracted/i)).toBeTruthy();
    // Signed values
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('-1')).toBeTruthy();
  });

  it('Cancel removes only the targeted entry', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', pending_modifiers: [
      { value: 2, source: 'Keep' },
      { value: 2, source: 'Drop' },
      { value: 2, source: 'Keep too' },
    ]};
    render(_kindsForTest.pending_modifiers_list({ ui, character, config }));
    const cancels = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancels).toHaveLength(3);
    fireEvent.click(cancels[1]);
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      pending_modifiers: [
        { value: 2, source: 'Keep' },
        { value: 2, source: 'Keep too' },
      ],
    });
  });

  it('clear-all wipes the stack', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', pending_modifiers: [
      { value: 2, source: 'A' }, { value: 3, source: 'B' },
    ]};
    render(_kindsForTest.pending_modifiers_list({ ui, character, config }));
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(patchEntity).toHaveBeenCalledWith('c1', { pending_modifiers: [] });
  });
});
