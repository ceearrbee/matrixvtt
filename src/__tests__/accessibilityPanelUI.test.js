/**
 * AccessibilityPanel UI tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent, screen } from '@testing-library/preact';
import { AccessibilityPanel } from '../ui/AccessibilityPanel.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  cleanup();
});

describe('AccessibilityPanel', () => {
  it('renders the reduced-motion checkbox and theme selector, with no redundant high-contrast checkbox', () => {
    render(h(AccessibilityPanel, {}));

    expect(screen.getByLabelText(/Reduced motion/i)).toBeTruthy();
    expect(screen.getByLabelText(/Theme/i)).toBeTruthy();
    // High contrast lives in the theme select; a second control that
    // mutated the same state was removed.
    expect(screen.queryByLabelText(/High contrast/i)).toBeNull();
  });

  it('updates reduced motion in localStorage and DOM', () => {
    render(h(AccessibilityPanel, {}));
    
    const checkbox = screen.getByLabelText(/Reduced motion/i);
    fireEvent.click(checkbox);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY) ?? '{}');
    expect(stored.reduced_motion).toBe(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('updates theme in localStorage and DOM', () => {
    render(h(AccessibilityPanel, {}));
    
    const select = screen.getByLabelText(/Theme/i);
    fireEvent.change(select, { target: { value: 'dark' } });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY) ?? '{}');
    expect(stored.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
