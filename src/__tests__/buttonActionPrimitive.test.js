/**
 * `button_action` - standalone button that fires an announce template
 * and adjusts a numeric field. The basic building block for compels,
 * "spend hold," GM utilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { _kindsForTest } from '../ui/characterSheetSections.js';

function makeUi({ patchEntity = vi.fn(), announceMessage = vi.fn() } = {}) {
  return {
    chat: { announceMessage },
    patchEntity,
    state: { canEditEntity: () => true, isGM: () => true, settings: { systemConfig: {} } },
    widgetManager: { userId: '@gm:hs', displayName: 'GM' },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('button_action', () => {
  const baseConfig = {
    kind: 'button_action',
    label: 'Compel',
    announce: '{actor} accepts a compel for +1 fate point',
    increment_field: 'fate_points',
    amount: 1,
  };

  it('renders the button with the configured label', () => {
    const ui = makeUi();
    const character = { id: 'c1', fate_points: 2 };
    render(_kindsForTest.button_action({ ui, character, config: baseConfig }));
    expect(screen.getByRole('button', { name: /compel/i })).toBeTruthy();
  });

  it('fires the announce template and increments the field on click', () => {
    const announceMessage = vi.fn();
    const patchEntity = vi.fn();
    const ui = makeUi({ announceMessage, patchEntity });
    const character = { id: 'c1', fate_points: 2 };
    render(_kindsForTest.button_action({ ui, character, config: baseConfig }));
    fireEvent.click(screen.getByRole('button', { name: /compel/i }));
    expect(announceMessage).toHaveBeenCalledWith('GM accepts a compel for +1 fate point');
    expect(patchEntity).toHaveBeenCalledWith('c1', { fate_points: 3 });
  });

  it('decrements via decrement_field instead of increment_field', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    const character = { id: 'c1', fate_points: 2 };
    render(_kindsForTest.button_action({
      ui, character, config: {
        kind: 'button_action', label: 'Spend',
        announce: '{actor} spends a fate point',
        decrement_field: 'fate_points',
      },
    }));
    fireEvent.click(screen.getByRole('button'));
    expect(patchEntity).toHaveBeenCalledWith('c1', { fate_points: 1 });
  });

  it('safety: both increment_field AND decrement_field set is a no-op', () => {
    const patchEntity = vi.fn();
    const ui = makeUi({ patchEntity });
    render(_kindsForTest.button_action({
      ui, character: { id: 'c1', x: 0 }, config: {
        kind: 'button_action', label: 'Bad',
        announce: '...',
        increment_field: 'x',
        decrement_field: 'x',
      },
    }));
    fireEvent.click(screen.getByRole('button'));
    expect(patchEntity).not.toHaveBeenCalled();
  });

  it('disable_when_lte gates the click', () => {
    const announceMessage = vi.fn();
    const patchEntity = vi.fn();
    const ui = makeUi({ announceMessage, patchEntity });
    render(_kindsForTest.button_action({
      ui, character: { id: 'c1', fate_points: 0 }, config: {
        ...baseConfig,
        disable_when_lte: { field: 'fate_points', value: 0 },
        increment_field: undefined,
        decrement_field: 'fate_points',
      },
    }));
    const btn = screen.getByRole('button');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(announceMessage).not.toHaveBeenCalled();
    expect(patchEntity).not.toHaveBeenCalled();
  });
});
