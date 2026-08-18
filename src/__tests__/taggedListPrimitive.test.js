/**
 * `tagged_list` section primitive - generalizes the deprecated
 * `aspects` kind. Renders a labeled list of strings from a configured
 * character field; an optional `row_action` adds a per-row button
 * that fires an announcement template and adjusts a resource field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';

import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn(), announceMessage = vi.fn(), ...rest } = {}) {
  return {
    chat: { announceMessage },
    patchEntity,
    state: {
      settings: { gm_user_ids: ['@gm:example.org'], systemConfig: {} },
      canEditEntity: () => true,
      isGM: () => true,
    },
    widgetManager: { userId: '@gm:example.org', displayName: 'GM' },
    ...rest,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tagged_list - read-only', () => {
  it('renders the label and one row per entry', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['Trouble: hot-headed', 'High concept: barbarian'] };
    const config = { kind: 'tagged_list', field: 'aspects', label: 'Aspects' };
    render(_kindsForTest.tagged_list({ ui, character, config }));
    expect(screen.getByText('Aspects')).toBeTruthy();
    expect(screen.getByText('Trouble: hot-headed')).toBeTruthy();
    expect(screen.getByText('High concept: barbarian')).toBeTruthy();
  });

  it('renders empty-state copy when the field is absent or empty', () => {
    const ui = makeUi();
    const character = { id: 'c1' };
    render(_kindsForTest.tagged_list({ ui, character, config: { kind: 'tagged_list', field: 'aspects', label: 'Aspects' } }));
    expect(screen.queryAllByRole('button').length).toBe(0);
  });

  it('omits the action button when row_action is not configured', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['Trouble'] };
    render(_kindsForTest.tagged_list({ ui, character, config: { kind: 'tagged_list', field: 'aspects', label: 'Aspects' } }));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('tagged_list - invokable row_action', () => {
  function fateConfig() {
    return {
      kind: 'tagged_list', field: 'aspects', label: 'Aspects',
      row_action: {
        label: 'Invoke',
        announce: '{actor} invokes [{value}] for +{modifier}',
        decrement_field: 'fate_points',
        modifier: 2,
        disable_when_lte: { field: 'fate_points', value: 0 },
      },
    };
  }

  it('renders an Invoke button for each row when row_action is set', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['A', 'B'], fate_points: 3 };
    render(_kindsForTest.tagged_list({ ui, character, config: fateConfig() }));
    expect(screen.getAllByRole('button', { name: /invoke/i })).toHaveLength(2);
  });

  it('clicking Invoke fires the announce template substituted and decrements the field', async () => {
    const announceMessage = vi.fn().mockResolvedValue(undefined);
    const patchEntity = vi.fn().mockResolvedValue(true);
    const ui = makeUi({ announceMessage, patchEntity });
    const character = { id: 'c1', aspects: ['Trouble: hot-headed'], fate_points: 3 };

    render(_kindsForTest.tagged_list({ ui, character, config: fateConfig() }));
    fireEvent.click(screen.getByRole('button', { name: /invoke/i }));

    expect(announceMessage).toHaveBeenCalledWith('GM invokes [Trouble: hot-headed] for +2');
    expect(patchEntity).toHaveBeenCalled();
    // Two patches expected: the pending_modifiers stack push and
    // the fate_points decrement.
    const patches = patchEntity.mock.calls.map(([, p]) => p);
    expect(patches.find((p) => 'fate_points' in p)).toMatchObject({ fate_points: 2 });
  });

  it('button is disabled when disable_when_lte threshold is met', () => {
    const ui = makeUi();
    const character = { id: 'c1', aspects: ['A'], fate_points: 0 };
    render(_kindsForTest.tagged_list({ ui, character, config: fateConfig() }));
    const btn = screen.getByRole('button', { name: /invoke/i });
    expect(btn.disabled).toBe(true);
  });

  it('disabled button is a no-op (no announce, no decrement)', () => {
    const announceMessage = vi.fn();
    const patchEntity = vi.fn();
    const ui = makeUi({ announceMessage, patchEntity });
    const character = { id: 'c1', aspects: ['A'], fate_points: 0 };
    render(_kindsForTest.tagged_list({ ui, character, config: fateConfig() }));
    fireEvent.click(screen.getByRole('button', { name: /invoke/i }));
    expect(announceMessage).not.toHaveBeenCalled();
    expect(patchEntity).not.toHaveBeenCalled();
  });
});
