/**
 * LogControls - filter + search live behind a single icon button.
 *
 * Default render is calm: only the icon button is visible. Clicking
 * opens a popover with filter pills + search box. A badge on the
 * trigger surfaces when filter or search is non-default so users can
 * always see that a filter is applied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { LogControls } from '../ui/LogControls.jsx';

function mkProps(over = {}) {
  return {
    search: '', filter: 'all',
    onSearchChange: vi.fn(), onFilterChange: vi.fn(),
    onLoadMore: vi.fn(), canLoadMore: true, loading: false,
    ...over,
  };
}

afterEach(() => { cleanup(); });

describe('LogControls', () => {
  it('renders only the trigger button at rest - no inline strip', () => {
    const { container } = render(h(LogControls, mkProps()));
    expect(container.querySelector('.log-controls__trigger')).not.toBeNull();
    expect(container.querySelector('.log-controls__popover')).toBeNull();
    expect(container.querySelector('.log-controls__search')).toBeNull();
  });

  it('clicking the trigger opens the popover with filter pills + search', () => {
    const { container } = render(h(LogControls, mkProps()));
    fireEvent.click(container.querySelector('.log-controls__trigger'));
    expect(container.querySelector('.log-controls__popover')).not.toBeNull();
    expect(container.querySelector('.log-controls__search')).not.toBeNull();
    expect(container.querySelectorAll('[data-log-filter]').length).toBeGreaterThanOrEqual(5);
  });

  it('clicking a filter pill calls onFilterChange', () => {
    const onFilterChange = vi.fn();
    const { container } = render(h(LogControls, mkProps({ onFilterChange })));
    fireEvent.click(container.querySelector('.log-controls__trigger'));
    fireEvent.click(container.querySelector('[data-log-filter="dice"]'));
    expect(onFilterChange).toHaveBeenCalledWith('dice');
  });

  it('shows a badge on the trigger when filter is non-default', () => {
    const { container } = render(h(LogControls, mkProps({ filter: 'dice' })));
    const badge = container.querySelector('.log-controls__badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('🎲');
  });

  it('shows a search badge when search query is non-empty', () => {
    const { container } = render(h(LogControls, mkProps({ search: 'foo' })));
    expect(container.querySelector('.log-controls__badge')).not.toBeNull();
  });

  it('Clear button resets both filter and search', () => {
    const onFilterChange = vi.fn();
    const onSearchChange = vi.fn();
    const { container } = render(h(LogControls, mkProps({
      filter: 'dice', search: 'foo',
      onFilterChange, onSearchChange,
    })));
    fireEvent.click(container.querySelector('.log-controls__trigger'));
    fireEvent.click(container.querySelector('.log-controls__clear'));
    expect(onFilterChange).toHaveBeenCalledWith('all');
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
