/**
 * ComposerChip primitive.
 *
 * Pill button used by:
 *   - active-character chip (left of the composer textarea)
 *   - target chip (Use… menu / current attack target)
 *   - OOC tab (with unread badge)
 *   - header tool-cluster buttons
 *
 * Visual model is rpglog's `.char-select-btn` + `.target-chip` + `.ooc-tab-btn`
 * unified into one primitive with optional icon and badge slots.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { ComposerChip } from '../ui/popups/ComposerChip.jsx';

afterEach(cleanup);

describe('ComposerChip', () => {
  it('renders a <button> with the given label', () => {
    const { container } = render(h(ComposerChip, { label: 'OOC' }));
    const btn = container.querySelector('button[data-composer-chip]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('OOC');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(h(ComposerChip, { label: 'Use…', onClick }));
    fireEvent.click(container.querySelector('button[data-composer-chip]'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an icon slot before the label when provided', () => {
    const { container } = render(h(ComposerChip, {
      label: 'Use…',
      icon: h('span', { 'data-test': 'icon' }, '🎯'),
    }));
    const btn = container.querySelector('button[data-composer-chip]');
    const icon = btn.querySelector('[data-test="icon"]');
    expect(icon).not.toBeNull();
    // Icon appears before the label text node in document order.
    expect(btn.innerHTML.indexOf('data-test="icon"'))
      .toBeLessThan(btn.innerHTML.indexOf('Use…'));
  });

  it('renders a badge when badge > 0, hides when badge falsy', () => {
    const { container, rerender } = render(h(ComposerChip, { label: 'OOC', badge: 3 }));
    const badge = container.querySelector('button[data-composer-chip] [data-chip-badge]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('3');

    rerender(h(ComposerChip, { label: 'OOC', badge: 0 }));
    expect(container.querySelector('[data-chip-badge]')).toBeNull();

    rerender(h(ComposerChip, { label: 'OOC' }));
    expect(container.querySelector('[data-chip-badge]')).toBeNull();
  });

  it('marks aria-pressed when selected=true (used by toggle chips)', () => {
    const { container, rerender } = render(h(ComposerChip, { label: 'IC', selected: true }));
    expect(container.querySelector('button[data-composer-chip]').getAttribute('aria-pressed')).toBe('true');
    rerender(h(ComposerChip, { label: 'IC', selected: false }));
    expect(container.querySelector('button[data-composer-chip]').getAttribute('aria-pressed')).toBe('false');
  });

  it('passes through aria-label when provided (icon-only chips)', () => {
    const { container } = render(h(ComposerChip, {
      label: 'IC',
      'aria-label': 'Switch in-character mode',
    }));
    expect(container.querySelector('button[data-composer-chip]').getAttribute('aria-label'))
      .toBe('Switch in-character mode');
  });

  it('supports a danger variant for destructive actions', () => {
    const { container } = render(h(ComposerChip, { label: 'Leave', variant: 'danger' }));
    expect(container.querySelector('button[data-composer-chip]').getAttribute('data-variant'))
      .toBe('danger');
  });

  it('disables the button when disabled=true', () => {
    const onClick = vi.fn();
    const { container } = render(h(ComposerChip, { label: 'Send', disabled: true, onClick }));
    const btn = container.querySelector('button[data-composer-chip]');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
