/**
 * TrackerListEditor - per-token counters (ammo, ki, spell slots, …).
 * Extracted from TokenFormModal.
 */

import { h } from 'preact';
import { rowKey } from '../../utils/row-key.js';

export function initialTrackers(token) {
  if (!token || !Array.isArray(token.trackers)) return [];
  return token.trackers.map((t) => ({
    _key: rowKey(),
    label: String(t?.label ?? ''),
    value: Number.isFinite(Number(t?.value)) ? Number(t.value) : 0,
    max: Number.isFinite(Number(t?.max)) ? Number(t.max) : '',
  }));
}

export function TrackerListEditor({ trackers, addTracker, removeTracker, updateTracker }) {
  const empty = trackers.length === 0;
  return h('div', { class: 'form-group', role: 'group', 'aria-label': 'Token trackers' }, [
    h('div', {
      class: 'form-label',
      style: 'display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);',
    }, [
      h('span', null, 'Trackers'),
      h('span', { class: 'form-help', style: 'font-weight:400;' },
        'Per-token counters (ammo, ki, spell slots, sanity, …). Shown in the combat tracker.'),
    ]),
    !empty && h('ul', {
      class: 'narrative-list',
      'aria-label': `${trackers.length} tracker${trackers.length === 1 ? '' : 's'} configured`,
    }, trackers.map((t, i) => h('li', {
      key: t._key ?? i,
      class: 'narrative-list__row',
      style: 'gap:var(--space-md);flex-wrap:wrap;',
    }, [
      h('label', { class: 'sr-only', for: `tracker-${i}-label` }, `Tracker ${i + 1} label`),
      h('input', {
        type: 'text',
        id: `tracker-${i}-label`,
        class: 'form-input',
        placeholder: 'Label (e.g. Ammo)',
        value: t.label,
        style: 'flex:2;min-width:120px;',
        'aria-label': `Tracker ${i + 1} label`,
        onInput: (e) => updateTracker(i, { label: e.currentTarget.value }),
      }),
      h('label', { class: 'sr-only', for: `tracker-${i}-value` }, `Tracker ${i + 1} value`),
      h('input', {
        type: 'number',
        id: `tracker-${i}-value`,
        class: 'form-input',
        value: t.value,
        style: 'width:72px;',
        'aria-label': `Tracker ${i + 1} value`,
        onInput: (e) => updateTracker(i, { value: parseInt(e.currentTarget.value, 10) || 0 }),
      }),
      h('span', { class: 'form-help', style: 'min-width:8px;' }, '/'),
      h('label', { class: 'sr-only', for: `tracker-${i}-max` }, `Tracker ${i + 1} max (optional)`),
      h('input', {
        type: 'number',
        id: `tracker-${i}-max`,
        class: 'form-input',
        placeholder: 'max',
        value: t.max,
        style: 'width:72px;',
        'aria-label': `Tracker ${i + 1} max`,
        onInput: (e) => {
          const raw = e.currentTarget.value;
          updateTracker(i, { max: raw === '' ? '' : (parseInt(raw, 10) || 0) });
        },
      }),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm dbt--ghost',
        'aria-label': `Remove tracker ${i + 1}`,
        onClick: () => removeTracker(i),
      }, 'Remove'),
    ]))),
    empty && h('div', { class: 'narrative-list__empty' }, 'No trackers.'),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm',
      onClick: addTracker,
    }, '+ Add tracker'),
  ]);
}
