/**
 * `tagged_list` with `editable: true` adds inline authoring affordances
 * directly to the sheet: an "Add" input + per-row Remove button. The
 * Fari approach - aspects are added on the sheet, not in a separate
 * form dialog.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn(), canEdit = true } = {}) {
  return {
    patchEntity,
    state: { canEditEntity: () => canEdit, isGM: () => true, settings: { systemConfig: {} } },
    widgetManager: { userId: '@me:hs' },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('tagged_list - editable mode', () => {
  const editableConfig = {
    kind: 'tagged_list', field: 'aspects', label: 'Aspects', editable: true,
    placeholder: 'Add an aspect…',
  };

  it('renders an Add input + button when editable is true', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: [] };
    render(_kindsForTest.tagged_list({ ui, character, config: editableConfig }));
    expect(screen.getByPlaceholderText('Add an aspect…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add/i })).toBeTruthy();
  });

  it('typing into Add input + clicking Add appends the entry and clears the input', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', aspects: ['Existing'] };
    render(_kindsForTest.tagged_list({ ui, character, config: editableConfig }));
    const input = screen.getByPlaceholderText('Add an aspect…');
    fireEvent.input(input, { target: { value: 'New aspect' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      aspects: ['Existing', 'New aspect'],
    });
    expect(input.value).toBe('');
  });

  it('Add does nothing when the input is empty or whitespace-only', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', aspects: [] };
    render(_kindsForTest.tagged_list({ ui, character, config: editableConfig }));
    const input = screen.getByPlaceholderText('Add an aspect…');
    fireEvent.input(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(patchEntity).not.toHaveBeenCalled();
  });

  it('renders a Remove button per row, click removes that entry', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', aspects: ['Keep', 'Drop', 'Keep too'] };
    render(_kindsForTest.tagged_list({ ui, character, config: editableConfig }));
    const removes = screen.getAllByRole('button', { name: /remove/i });
    expect(removes).toHaveLength(3);
    fireEvent.click(removes[1]); // remove "Drop"
    expect(patchEntity).toHaveBeenCalledWith('c1', {
      aspects: ['Keep', 'Keep too'],
    });
  });

  it('does not render edit affordances when canEditEntity returns false', () => {
    const ui = makeUi({ canEdit: false });
    const character = { id: 'c1', aspects: ['A'] };
    render(_kindsForTest.tagged_list({ ui, character, config: editableConfig }));
    expect(screen.queryByPlaceholderText('Add an aspect…')).toBeNull();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('non-editable config (default) does not show any edit affordances', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['A'] };
    render(_kindsForTest.tagged_list({
      ui, character, config: { kind: 'tagged_list', field: 'aspects', label: 'Aspects' },
    }));
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('editable + row_action: both Remove and Invoke buttons per row', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['Trouble'], fate_points: 3 };
    render(_kindsForTest.tagged_list({
      ui, character, config: {
        ...editableConfig,
        row_action: { label: 'Invoke', announce: '{actor} invokes [{value}]', decrement_field: 'fate_points', modifier: 2 },
      },
    }));
    expect(screen.getByRole('button', { name: /invoke/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove/i })).toBeTruthy();
  });
});
