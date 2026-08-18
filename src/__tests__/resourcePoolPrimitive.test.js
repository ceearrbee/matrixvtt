/**
 * `resource_pool` - discrete spend/refill integer pool. Distinct from
 * `resource_track` (HP-bar variant). Used for fate points, PbtA hold,
 * WoD willpower, etc.
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

beforeEach(() => { document.body.innerHTML = ''; });

describe('resource_pool', () => {
  const baseConfig = { kind: 'resource_pool', field: 'fate_points', label: 'Fate Points' };

  it('renders the label and the current value', () => {
    const ui = makeUi();
    const character = { id: 'c1', fate_points: 3 };
    render(_kindsForTest.resource_pool({ ui, character, config: baseConfig }));
    expect(screen.getByText('Fate Points')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('+ increments the field', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 2 };
    render(_kindsForTest.resource_pool({ ui, character, config: baseConfig }));
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(patchEntity).toHaveBeenCalledWith('c1', { fate_points: 3 });
  });

  it('− decrements the field, clamped at min (default 0)', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 0 };
    render(_kindsForTest.resource_pool({ ui, character, config: baseConfig }));
    fireEvent.click(screen.getByRole('button', { name: /decrease/i }));
    // Already at min; should not go below 0
    expect(patchEntity).not.toHaveBeenCalled();
  });

  it('honors explicit min', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 1 };
    render(_kindsForTest.resource_pool({ ui, character, config: { ...baseConfig, min: 1 } }));
    fireEvent.click(screen.getByRole('button', { name: /decrease/i }));
    expect(patchEntity).not.toHaveBeenCalled();
  });

  it('honors max_field', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 5, fate_max: 5 };
    render(_kindsForTest.resource_pool({ ui, character, config: { ...baseConfig, max_field: 'fate_max' } }));
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(patchEntity).not.toHaveBeenCalled();
  });

  it('Refresh button sets the field to character[refresh_field]', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 1, fate_refresh: 3 };
    render(_kindsForTest.resource_pool({ ui, character, config: { ...baseConfig, refresh_field: 'fate_refresh' } }));
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(patchEntity).toHaveBeenCalledWith('c1', { fate_points: 3 });
  });

  it('omits Refresh button when refresh_field is not configured', () => {
    const ui = makeUi();
    const character = { id: 'c1', fate_points: 1 };
    render(_kindsForTest.resource_pool({ ui, character, config: baseConfig }));
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
  });
});
