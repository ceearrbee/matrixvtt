/**
 * FloatingPopup primitive.
 *
 * A popup anchored to the composer with rpglog-style semantics:
 *   - opens on demand from a chip / slash command / shortcut
 *   - ESC closes; outside-click closes (unless pinned)
 *   - has a pin button that toggles persistent-open behavior
 *   - traps focus while open, returns focus to opener on close
 *   - portals to <body> so stacking context is independent of the chat shell
 *
 * Reuses `trapFocusIn` from src/ui/modal-focus.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { FloatingPopup } from '../ui/popups/FloatingPopup.jsx';

afterEach(() => {
  cleanup();
  // Portal renders to body - sweep stragglers between tests.
  document.body.querySelectorAll('[data-floating-popup]').forEach((n) => n.remove());
});

describe('FloatingPopup', () => {
  it('renders nothing when open=false', () => {
    render(h(FloatingPopup, { open: false, name: 'dice', title: 'Dice', onClose: () => {} }, 'body'));
    expect(document.querySelector('[data-floating-popup="dice"]')).toBeNull();
  });

  it('renders a dialog with the given title and children when open=true', () => {
    render(h(FloatingPopup, { open: true, name: 'dice', title: 'Dice Roller', onClose: () => {} },
      h('button', null, 'roll')
    ));
    const pop = document.querySelector('[data-floating-popup="dice"]');
    expect(pop).not.toBeNull();
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.textContent).toContain('Dice Roller');
    expect(pop.textContent).toContain('roll');
  });

  it('fires onClose on Escape', () => {
    const onClose = vi.fn();
    render(h(FloatingPopup, { open: true, name: 'sheet', title: 'Sheet', onClose }, 'body'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on outside click', () => {
    const onClose = vi.fn();
    render(h(FloatingPopup, { open: true, name: 'init', title: 'Init', onClose }, 'body'));
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onClose on inside click', () => {
    const onClose = vi.fn();
    render(h(FloatingPopup, { open: true, name: 'init', title: 'Init', onClose },
      h('button', { id: 'inside' }, 'inside')
    ));
    fireEvent.mouseDown(document.getElementById('inside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a pin button when onTogglePin is provided, and invokes it on click', () => {
    const onTogglePin = vi.fn();
    render(h(FloatingPopup, {
      open: true, name: 'dice', title: 'Dice',
      pinned: false, onTogglePin, onClose: () => {},
    }, 'body'));
    const pin = document.querySelector('[data-floating-popup="dice"] [data-popup-pin]');
    expect(pin).not.toBeNull();
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('reflects pinned=true via aria-pressed on the pin button', () => {
    render(h(FloatingPopup, {
      open: true, name: 'dice', title: 'Dice',
      pinned: true, onTogglePin: () => {}, onClose: () => {},
    }, 'body'));
    const pin = document.querySelector('[data-floating-popup="dice"] [data-popup-pin]');
    expect(pin.getAttribute('aria-pressed')).toBe('true');
  });

  it('when pinned, ESC and outside-click do NOT close', () => {
    const onClose = vi.fn();
    render(h(FloatingPopup, {
      open: true, name: 'dice', title: 'Dice',
      pinned: true, onTogglePin: () => {}, onClose,
    }, 'body'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('always renders a close (×) button that fires onClose, even when pinned', () => {
    const onClose = vi.fn();
    render(h(FloatingPopup, {
      open: true, name: 'dice', title: 'Dice',
      pinned: true, onTogglePin: () => {}, onClose,
    }, 'body'));
    const closeBtn = document.querySelector('[data-floating-popup="dice"] [data-popup-close]');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('portals to document.body (not the @testing-library container)', () => {
    const { container } = render(h(FloatingPopup, { open: true, name: 'dice', title: 'Dice', onClose: () => {} },
      'body'
    ));
    // The container itself should not contain the popup chrome - it lives on body.
    expect(container.querySelector('[data-floating-popup="dice"]')).toBeNull();
    expect(document.body.querySelector('[data-floating-popup="dice"]')).not.toBeNull();
  });

  it('has aria-labelledby tied to the title element', () => {
    render(h(FloatingPopup, { open: true, name: 'sheet', title: 'Character Sheet', onClose: () => {} }, 'body'));
    const pop = document.querySelector('[data-floating-popup="sheet"]');
    const labelledBy = pop.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy);
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe('Character Sheet');
  });
});
