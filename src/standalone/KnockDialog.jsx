/**
 * Knock request dialog: replaces the window.confirm + window.prompt
 * pair in the join-forbidden flow with the app's modal stack.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Modal } from '../ui/Modal.jsx';
import { openModal } from '../ui/modal-host.js';

function KnockDialogBody({ idOrAlias, onDecide }) {
  const [reason, setReason] = useState('');
  return h('div', null, [
    h('p', { style: 'margin-bottom: 12px;' },
      `This room is private. Send a knock request to ${idOrAlias} so a member can approve your join?`),
    h('label', { for: 'knock-reason' }, 'Reason (optional)'),
    h('input', {
      id: 'knock-reason', class: 'form-input', type: 'text',
      'data-knock-reason': true, autocomplete: 'off',
      value: reason, onInput: (e) => setReason(e.target.value),
    }),
    h('div', { class: 'form-actions', style: 'margin-top: 16px;' }, [
      h('button', { type: 'button', class: 'dbt', 'data-cancel': true, onClick: () => onDecide(false, '') }, 'Cancel'),
      h('button', { type: 'button', class: 'dbt btn-primary', 'data-confirm': true, onClick: () => onDecide(true, reason) }, 'Send knock'),
    ]),
  ]);
}

/**
 * @param {string} idOrAlias
 * @returns {Promise<{ok: boolean, reason: string}>}
 */
export function promptKnock(idOrAlias) {
  return new Promise((resolve) => {
    let decided = false;
    openModal((close) => h(Modal, {
      id: 'knock-dialog',
      title: 'Request to join',
      maxWidth: '420px',
      onClose: () => {
        close();
        if (!decided) resolve({ ok: false, reason: '' });
      },
    }, [h(KnockDialogBody, {
      idOrAlias,
      onDecide: (ok, reason) => {
        decided = true;
        close();
        resolve({ ok, reason });
      },
    })]));
  });
}
