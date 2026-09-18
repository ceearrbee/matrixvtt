/**
 * Actions that act on a selection of tokens rather than one.
 *
 * Split from combat.js, which owns the single-token dialogs and the
 * damage-audit path these call into, because both together pushed one
 * file past the size where it stops being readable.
 */

import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { getConditions } from '../../state/rulesets.js';
import {
  applyDamageToTokens, applyHealing, addCondition, removeCondition,
} from './combat.js';

/**
 * Damage or heal every selected token at once. The amount applies to
 * each, which is what a fireball does; a split is the GM's arithmetic,
 * not ours to guess.
 */
export function showGroupDamageDialog(mr, type = 'damage') {
  const ids = [...(mr.selectedTokenIds ?? [])];
  if (ids.length === 0) return;
  const isHeal = type === 'heal';
  openModal((close) =>
    h(Modal, {
      id: 'dmg-modal',
      title: `${isHeal ? 'Heal' : 'Damage'} ${ids.length} tokens`,
      maxWidth: '300px', autoFocusSelector: '#dmg-amount', onClose: close,
    }, h(GroupDamageDialog, { mr, ids, isHeal, onClose: close })),
  );
}

function GroupDamageDialog({ mr, ids, isHeal, onClose }) {
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const apply = async () => {
    const input = rootRef.current.querySelector('#dmg-amount');
    const amt = parseInt(input.value) || 0;
    if (amt <= 0) { setError('Enter a positive number.'); input.focus(); return; }
    onClose();
    if (isHeal) for (const id of ids) await applyHealing(mr, id, amt);
    else await applyDamageToTokens(mr, ids, amt);
  };
  return h('div', { ref: rootRef }, [
    h('p', { class: 'form-help', style: 'margin-top:0;' },
      `Applies to each of the ${ids.length} selected tokens.`),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'dmg-amount' }, 'Amount'),
      h('input', { type: 'number', class: 'form-input', id: 'dmg-amount', defaultValue: 0, min: '1' }),
      error && h('p', { class: 'form-error', role: 'alert' }, error),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', onClick: apply }, isHeal ? 'Heal' : 'Apply'),
    ]),
  ]);
}

/** Apply one condition change to every selected token. */
export function showGroupConditionDialog(mr) {
  const ids = [...(mr.selectedTokenIds ?? [])];
  if (ids.length === 0) return;
  openModal((close) =>
    h(Modal, {
      id: 'cond-modal',
      title: `Conditions on ${ids.length} tokens`,
      maxWidth: '420px', autoFocusSelector: '#cond-filter', onClose: close,
    }, h(GroupConditionDialog, { mr, ids, onClose: close })),
  );
}

function GroupConditionDialog({ mr, ids, onClose }) {
  const systemConfig = mr.state?.settings?.systemConfig;
  const declared = getConditions(systemConfig);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const shown = declared.filter((c) => !needle
    || c.key.toLowerCase().includes(needle)
    || c.label.toLowerCase().includes(needle));

  const applyTo = (key, add) => async () => {
    onClose();
    for (const id of ids) {
      if (add) await addCondition(mr, id, key);
      else await removeCondition(mr, id, key);
    }
  };

  return h('div', null, [
    h('p', { class: 'form-help', style: 'margin-top:0;' },
      `Add or clear a condition on all ${ids.length} selected tokens.`),
    h('label', { class: 'sr-only', for: 'cond-filter' }, 'Filter conditions'),
    h('input', {
      type: 'search', id: 'cond-filter', class: 'form-input',
      placeholder: 'Filter conditions…', autocomplete: 'off',
      value: filter, onInput: (e) => setFilter(e.currentTarget.value),
    }),
    h('div', { class: 'cond-list', role: 'group', 'aria-label': 'Conditions' },
      shown.map((c) => h('div', { class: 'cond-list__row', key: c.key }, [
        h('span', null, c.label),
        h('span', { class: 'cond-list__actions' }, [
          h('button', {
            type: 'button', class: 'dbt dbt--sm',
            'aria-label': `Add ${c.label} to all selected tokens`,
            onClick: applyTo(c.key, true),
          }, 'Add'),
          h('button', {
            type: 'button', class: 'dbt dbt--sm',
            'aria-label': `Clear ${c.label} from all selected tokens`,
            onClick: applyTo(c.key, false),
          }, 'Clear'),
        ]),
      ]))),
    declared.length === 0 && h('p', { class: 'form-help' },
      'This game system declares no conditions.'),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true }, 'Close'),
    ]),
  ]);
}
