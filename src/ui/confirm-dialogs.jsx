/**
 * Preact confirm dialogs + imperative helpers. The exported functions keep
 * the signatures the old ModalFactory.confirm / confirmAsync / confirmTyped
 * had, so call sites only change which module they import from.
 *
 * `message` may be a string or a Preact vnode (callers that need emphasis
 * pass a vnode instead of an HTML string).
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';

function ConfirmDialog({ id, title, message, confirmText, cancelText, confirmClass, confirmId, onConfirm, onClose }) {
  return h(Modal, { id, title, maxWidth: '400px', onClose }, [
    h('p', { style: 'margin-bottom: 20px;' }, message),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-cancel': true, onClick: onClose }, cancelText),
      h('button', {
        type: 'button', class: `dbt ${confirmClass}`, 'data-confirm': true, id: confirmId || undefined,
        onClick: () => { onConfirm?.(); onClose?.(); },
      }, confirmText),
    ]),
  ]);
}

function ConfirmAsyncDialog({ id, title, message, confirmText, busyText, cancelText, confirmClass, confirmId, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || String(err));
      setBusy(false);
    }
  };
  return h(Modal, { id, title, maxWidth: '420px', onClose }, [
    h('p', { style: 'margin-bottom: 16px;' }, message),
    error
      ? h('div', {
          class: 'confirm-async-error', 'data-error': true, role: 'alert',
          style: 'color:var(--color-text-danger);font-size:var(--font-size-sm);margin-bottom:12px;',
        }, error)
      : null,
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-cancel': true, disabled: busy, onClick: onClose }, cancelText),
      h('button', {
        type: 'button', class: `dbt ${confirmClass}`, 'data-confirm': true, id: confirmId || undefined, disabled: busy, onClick: run,
      }, busy ? busyText : confirmText),
    ]),
  ]);
}

function ConfirmTypedDialog({ id, title, message, phrase, confirmText, cancelText, confirmClass, onConfirm, onClose }) {
  const [value, setValue] = useState('');
  const instrId = `${id}-instr`;
  const matched = value === phrase;
  return h(Modal, { id, title, maxWidth: '440px', autoFocusSelector: '[data-typed-input]', onClose }, [
    h('p', { style: 'margin-bottom: 12px;' }, message),
    h('p', {
      id: instrId,
      style: 'margin-bottom: 8px; color: var(--color-text-secondary); font-size: var(--font-size-sm);',
    }, ['Type ', h('strong', null, phrase), ' to confirm.']),
    h('input', {
      type: 'text', 'data-typed-input': true, 'aria-describedby': instrId,
      'aria-label': `Type ${phrase} to confirm`,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
      style: 'width: 100%; margin-bottom: 16px;',
      value, onInput: (e) => setValue(e.target.value),
    }),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-cancel': true, onClick: onClose }, cancelText),
      h('button', {
        type: 'button', class: `dbt ${confirmClass}`, 'data-confirm': true, disabled: !matched,
        onClick: () => { if (matched) { onConfirm?.(); onClose?.(); } },
      }, confirmText),
    ]),
  ]);
}

/**
 * Wrap the openModal `close` so every dismissal that isn't an explicit
 * confirm runs `onCancel`. The confirm path flips `confirmed` first (the
 * dialog calls onConfirm before onClose), so cancel/X/Escape/overlay all
 * route to onCancel while confirm does not.
 */
function withCancel(onCancel, build) {
  let didConfirm = false;
  return openModal((close) => {
    const guardedClose = () => { close(); if (!didConfirm) onCancel?.(); };
    const markConfirmed = () => { didConfirm = true; };
    return build(guardedClose, markConfirmed);
  });
}

export function confirm(message, onConfirm, options = {}) {
  const {
    title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel',
    confirmClass = 'btn-primary', id = 'confirm-modal', confirmId = null, onCancel = null,
  } = options;
  return withCancel(onCancel, (close, markConfirmed) =>
    h(ConfirmDialog, {
      id, title, message, confirmText, cancelText, confirmClass, confirmId,
      onConfirm: () => { markConfirmed(); onConfirm?.(); }, onClose: close,
    }),
  );
}

/**
 * Promise-flavoured confirm for await-style callers. Resolves true on
 * confirm; false on cancel, X, Escape, or overlay dismissal.
 */
export function confirmed(message, options = {}) {
  return new Promise((resolve) => {
    confirm(message, () => resolve(true), { ...options, onCancel: () => resolve(false) });
  });
}

export function confirmAsync(message, onConfirm, options = {}) {
  const {
    title = 'Confirm', confirmText = 'Confirm', busyText = 'Working…', cancelText = 'Cancel',
    confirmClass = 'btn-primary', id = 'confirm-async-modal', confirmId = null, onCancel = null,
  } = options;
  return withCancel(onCancel, (close, markConfirmed) =>
    h(ConfirmAsyncDialog, {
      id, title, message, confirmText, busyText, cancelText, confirmClass, confirmId,
      // Mark confirmed only after the async work resolves - a rejected
      // attempt the user then dismisses should still count as a cancel.
      onConfirm: async () => { await onConfirm?.(); markConfirmed(); }, onClose: close,
    }),
  );
}

export function confirmTyped(message, phrase, onConfirm, options = {}) {
  const {
    title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel',
    confirmClass = 'dbt--danger', id = 'confirm-typed-modal', onCancel = null,
  } = options;
  return withCancel(onCancel, (close, markConfirmed) =>
    h(ConfirmTypedDialog, {
      id, title, message, phrase, confirmText, cancelText, confirmClass,
      onConfirm: () => { markConfirmed(); onConfirm?.(); }, onClose: close,
    }),
  );
}
