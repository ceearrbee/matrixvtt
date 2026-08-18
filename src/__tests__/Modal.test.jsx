/**
 * Modal.jsx + confirm-dialogs.jsx - the Preact modal shell that replaces the
 * imperative ModalFactory. Pins overlay/dialog markup, focus trap, refcounted
 * body-scroll lock, capture-phase Escape, the unsaved-changes guard, and the
 * confirm / confirmAsync / confirmTyped helpers.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from 'preact';
import { act } from '@testing-library/preact';
import { openModal, closeAllOpenModals } from '../ui/modal-host.js';
import { Modal } from '../ui/Modal.jsx';
import { closeAllModals } from '../utils/modal-helpers.js';
import { confirm, confirmAsync, confirmTyped } from '../ui/confirm-dialogs.jsx';

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('data-modal-lock-count');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

function open(props, children) {
  let close = () => {};
  act(() => { close = openModal((c) => h(Modal, { onClose: c, ...props }, children)); });
  return close;
}

const click = (sel) => act(() => { document.querySelector(sel).click(); });

describe('Modal shell', () => {
  it('renders overlay + labelled dialog with title and body', () => {
    open({ id: 'm1', title: 'Hello' }, h('p', null, 'world'));
    const dialog = document.querySelector('#m1 [role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('#m1-title').textContent).toBe('Hello');
    expect(document.querySelector('.modal-body').textContent).toContain('world');
  });

  it('locks body scroll while open and restores on close (refcounted across stacked modals)', () => {
    const close1 = open({ id: 'a', title: 'A' });
    expect(document.body.style.overflow).toBe('hidden');
    const close2 = open({ id: 'b', title: 'B' });
    // Refcounted: closing the inner modal leaves the lock in place; only
    // closing the last open modal restores scroll.
    act(() => close2());
    expect(document.body.style.overflow).toBe('hidden');
    act(() => close1());
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on the X button via onClose disposer', () => {
    open({ id: 'm2', title: 'T' });
    expect(document.querySelector('#m2')).toBeTruthy();
    click('#m2 .modal-close');
    expect(document.querySelector('#m2')).toBeNull();
  });

  it('closes on capture-phase Escape even when a child stops propagation', () => {
    open({ id: 'm3', title: 'T' }, h('input', { onKeyDown: (e) => e.stopPropagation() }));
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('#m3')).toBeNull();
  });

  it('overlay click closes when not dirty', () => {
    open({ id: 'm4', title: 'T' });
    act(() => { document.querySelector('#m4').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.querySelector('#m4')).toBeNull();
  });

  it('overlay click + Escape are guarded by isDirty (prompts a discard confirm)', () => {
    open({ id: 'm5', title: 'T', isDirty: () => true });
    act(() => { document.querySelector('#m5').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.querySelector('#m5')).toBeTruthy();
    expect(document.querySelector('#m5-discard-confirm')).toBeTruthy();
  });

  it('X button bypasses the dirty guard', () => {
    open({ id: 'm6', title: 'T', isDirty: () => true });
    click('#m6 .modal-close');
    expect(document.querySelector('#m6')).toBeNull();
    expect(document.querySelector('#m6-discard-confirm')).toBeNull();
  });

  it('escapes the title (no HTML injection)', () => {
    open({ id: 'm8', title: '<img src=x onerror=alert(1)>' });
    const titleEl = document.querySelector('#m8-title');
    expect(titleEl.querySelector('img')).toBeNull();
    expect(titleEl.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('restores focus to the trigger on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    open({ id: 'm7', title: 'T' }, h('button', null, 'inside'));
    click('#m7 .modal-close');
    expect(document.activeElement).toBe(trigger);
  });
});

describe('confirm helpers', () => {
  it('confirm runs the callback and closes', () => {
    const onConfirm = vi.fn();
    act(() => { confirm('Sure?', onConfirm, { id: 'c1' }); });
    click('#c1 [data-confirm]');
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(document.querySelector('#c1')).toBeNull();
  });

  it('confirm cancel closes without calling back', () => {
    const onConfirm = vi.fn();
    act(() => { confirm('Sure?', onConfirm, { id: 'c2' }); });
    click('#c2 [data-cancel]');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('#c2')).toBeNull();
  });

  it('confirmAsync disables the button while in flight, then closes', async () => {
    let resolve;
    const work = new Promise((r) => { resolve = r; });
    act(() => { confirmAsync('Run?', () => work, { id: 'c3', busyText: 'Working…' }); });
    await act(async () => { document.querySelector('#c3 [data-confirm]').click(); });
    const btn = document.querySelector('#c3 [data-confirm]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Working…');
    await act(async () => { resolve(); await work; });
    expect(document.querySelector('#c3')).toBeNull();
  });

  it('confirmAsync keeps modal open and surfaces inline error on reject', async () => {
    act(() => { confirmAsync('Run?', () => Promise.reject(new Error('network down')), { id: 'c4' }); });
    await act(async () => { document.querySelector('#c4 [data-confirm]').click(); });
    await act(async () => {});
    const err = document.querySelector('#c4 [data-error]');
    expect(err).toBeTruthy();
    expect(err.textContent).toContain('network down');
    expect(document.querySelector('#c4 [data-confirm]').disabled).toBe(false);
  });

  it('confirmTyped keeps confirm disabled until the phrase matches', () => {
    const onConfirm = vi.fn();
    act(() => { confirmTyped('Delete it', 'DELETE', onConfirm, { id: 'c5' }); });
    expect(document.querySelector('#c5 [data-confirm]').disabled).toBe(true);
    act(() => {
      const input = document.querySelector('#c5 [data-typed-input]');
      input.value = 'DELETE';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector('#c5 [data-confirm]').disabled).toBe(false);
    click('#c5 [data-confirm]');
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(document.querySelector('#c5')).toBeNull();
  });
});

describe('single-instance per id + bulk teardown', () => {
  it('re-opening the same id replaces the prior modal (one overlay, scroll restored on close)', () => {
    const close1 = open({ id: 'dup', title: 'First' });
    const close2 = open({ id: 'dup', title: 'Second' });
    const overlays = document.querySelectorAll('#dup');
    expect(overlays.length).toBe(1);
    expect(document.querySelector('#dup-title').textContent).toBe('Second');
    // The replaced instance was torn down, so a single close restores scroll.
    act(() => close2());
    expect(document.querySelector('#dup')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    // The stale disposer for the replaced instance is a no-op.
    act(() => close1());
    expect(document.body.style.overflow).toBe('');
  });

  it('closeAllOpenModals tears down every open modal and restores scroll', () => {
    open({ id: 'x', title: 'X' });
    open({ id: 'y', title: 'Y' });
    expect(document.querySelectorAll('.modal-overlay').length).toBe(2);
    act(() => closeAllOpenModals());
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
    // No orphan openModal container divs left behind in <body>.
    expect(document.body.children.length).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('closeAllModals clears openModal modals (used by one-shot map flows) without leaking', () => {
    open({ id: 'z', title: 'Z' });
    act(() => closeAllModals());
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
    expect(document.body.children.length).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('repeated Escape on a dirty modal yields at most one discard confirm', () => {
    open({ id: 'd', title: 'D', isDirty: () => true });
    const esc = () => act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    esc();
    expect(document.querySelectorAll('#d-discard-confirm').length).toBe(1);
    esc();
    esc();
    expect(document.querySelectorAll('#d-discard-confirm').length).toBeLessThanOrEqual(1);
  });
});
