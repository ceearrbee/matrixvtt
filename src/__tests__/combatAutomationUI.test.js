/**
 * Combat automation settings panel UI.
 * Refactored to test the Preact component semantically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent, screen } from '@testing-library/preact';
import { CombatAutomationPanel } from '../ui/CombatAutomationPanel.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CombatAutomationPanel', () => {
  const ui = {
    state: {
      isGM: () => true,
    }
  };

  it('renders checkboxes for automation options', () => {
    render(h(CombatAutomationPanel, { ui }));
    
    expect(screen.getByLabelText(/Announce rounds/i)).toBeTruthy();
    expect(screen.getByLabelText(/Auto-reveal fog on move/i)).toBeTruthy();
  });

  it('reflects current settings as checked/unchecked', () => {
    localStorage.setItem(STORAGE_KEYS.COMBAT_AUTOMATION, JSON.stringify({
      auto_announce_round: false,
      auto_reveal_fog: true,
    }));

    render(h(CombatAutomationPanel, { ui }));

    expect(screen.getByLabelText(/Auto-reveal fog on move/i).checked).toBe(true);
    expect(screen.getByLabelText(/Announce rounds/i).checked).toBe(false);
  });

  it('saves setting to localStorage when checkbox toggled', () => {
    render(h(CombatAutomationPanel, { ui }));
    
    const checkbox = screen.getByLabelText(/Auto-reveal fog on move/i);
    fireEvent.click(checkbox);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMBAT_AUTOMATION) ?? '{}');
    expect(stored.auto_reveal_fog).toBe(false);
  });

  it('saves false when checkbox is unchecked', () => {
    localStorage.setItem(STORAGE_KEYS.COMBAT_AUTOMATION, JSON.stringify({
      auto_announce_round: true,
    }));

    render(h(CombatAutomationPanel, { ui }));
    
    const checkbox = screen.getByLabelText(/Announce rounds/i);
    fireEvent.click(checkbox); // toggles to false

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMBAT_AUTOMATION) ?? '{}');
    expect(stored.auto_announce_round).toBe(false);
  });

  it('updates initiative mode in localStorage', () => {
    render(h(CombatAutomationPanel, { ui }));
    
    const select = screen.getByLabelText(/Initiative mode/i);
    fireEvent.change(select, { target: { value: 'side' } });

    expect(localStorage.getItem('vtt:initiative-mode-override')).toBe('side');
  });
});
