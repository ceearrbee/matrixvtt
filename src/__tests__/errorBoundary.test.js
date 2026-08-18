/**
 * The ErrorBoundary wraps the standalone shell so an uncaught render
 * throw doesn't leave the user staring at a blank page with no path
 * back. Without it, a single bug anywhere in the screen tree blanks
 * the entire app and the only recovery is a hard reload of an
 * unknown stale state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';

function ThrowingChild({ message = 'kaboom' }) {
  throw new Error(message);
}

beforeEach(() => {
  document.body.innerHTML = '';
  // Silence the logger.error spam from the boundary's componentDidCatch.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(h(ErrorBoundary, null, h('div', { 'data-testid': 'ok' }, 'fine')));
    expect(screen.getByTestId('ok')).toBeTruthy();
  });

  it('catches a render error and shows the recovery card', () => {
    render(h(ErrorBoundary, null, h(ThrowingChild, { message: 'split happened' })));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    // The error message is surfaced for bug-report copy/paste.
    expect(screen.getByText(/split happened/)).toBeTruthy();
  });

  it('shows Reload + Reset buttons inside the recovery card', () => {
    render(h(ErrorBoundary, null, h(ThrowingChild)));
    expect(screen.getByRole('button', { name: /^reload$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reset session/i })).toBeTruthy();
  });
});
