/**
 * TableFormModal - create/edit a rollable table with structured per-entry
 * rows. Each entry has Weight / Text / Linked item / Remove. Replaces
 * the freeform textarea + `[[item:<id>]]` parsing approach.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { EVENT_TYPES } from '../../utils/constants.js';
import { saveChildEntity } from '../child-entity-crud.js';
import { allocateEntityId } from '../../utils/stable-id.js';
import { esc } from '../../utils/component.js';
import { rowKey } from '../../utils/row-key.js';
import { ItemPicker } from './ItemPicker.jsx';

function _initialEntries(existing) {
  const arr = Array.isArray(existing?.entries) ? existing.entries : [];
  if (arr.length === 0) return [{ _key: rowKey(), weight: 1, text: '', item_id: null }];
  return arr.map(e => ({
    _key: rowKey(),
    weight: Number(e.weight) > 0 ? Number(e.weight) : 1,
    text: typeof e.text === 'string' ? e.text : '',
    item_id: e.item_id || null,
  }));
}

function _serialise(rows) {
  return rows
    .map(r => {
      const text = (r.text ?? '').trim();
      const weight = Number(r.weight) > 0 ? Number(r.weight) : 1;
      const entry = { weight, text };
      if (r.item_id) entry.item_id = r.item_id;
      return entry;
    })
    .filter(e => e.text || e.item_id);
}

function EntryRow({ row, items, onPatch, onRemove, canRemove }) {
  return h(
    'div',
    {
      class: 'table-entry',
      style:
        'display:grid;grid-template-columns:64px 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px;',
    },
    [
      h('input', {
        type: 'number',
        min: '1',
        class: 'form-input',
        'aria-label': 'Entry weight',
        value: row.weight,
        onInput: e => onPatch({ weight: Math.max(1, parseInt(e.target.value) || 1) }),
      }),
      h('input', {
        type: 'text',
        class: 'form-input',
        placeholder: 'Result text',
        'aria-label': 'Entry text',
        value: row.text,
        onInput: e => onPatch({ text: e.target.value }),
      }),
      h(ItemPicker, {
        items,
        value: row.item_id,
        onChange: id => onPatch({ item_id: id }),
      }),
      h(
        'button',
        {
          type: 'button',
          class: 'dbt dbt--compact',
          'aria-label': 'Remove entry',
          title: 'Remove entry',
          disabled: !canRemove,
          onClick: onRemove,
        },
        '✕'
      ),
    ]
  );
}

function TableForm({ ui, editId, onClose }) {
  const existing = editId ? ui.state.tables.get(editId) : null;
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? '');
  const [rows, setRows] = useState(_initialEntries(existing));
  const items = ui.state.items;

  const patchRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = i => setRows(rs => rs.filter((_, idx) => idx !== i));
  const addRow = () => setRows(rs => [...rs, { _key: rowKey(), weight: 1, text: '', item_id: null }]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      ui._toast?.('Table name is required', 'error');
      return;
    }
    const entries = _serialise(rows);
    if (entries.length === 0) {
      ui._toast?.('Add at least one entry', 'error');
      return;
    }
    const id =
      editId ??
      (await allocateEntityId('table', ui.state.tables));
    const ok = await saveChildEntity(ui, {
      eventType: EVENT_TYPES.TABLE,
      id,
      entity: { name: trimmedName, entries },
      noun: 'table',
      verb: isEdit ? 'update' : 'create',
    });
    if (ok && !isEdit)
      ui._log?.('🎲', `Table created: <b>${esc(trimmedName)}</b> (${entries.length} entries)`);
    if (ok) onClose();
  };

  return h('div', null, [
    h('div', { class: 'form-group' }, [
      h('label', { for: 'table-name' }, ['Table name ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', {
        id: 'table-name',
        type: 'text',
        class: 'form-input',
        placeholder: 'e.g. Random Encounter',
        required: true,
        'aria-required': 'true',
        value: name,
        onInput: e => setName(e.target.value),
      }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', null, 'Entries'),
      h(
        'div',
        {
          class: 'table-entries',
          'data-table-entries': true,
          style:
            'display:grid;grid-template-columns:64px 1fr 1fr auto;gap:6px;align-items:center;font-size:11px;color:var(--color-text-secondary);margin-bottom:4px;',
        },
        ['Weight', 'Text', 'Linked item', '']
      ),
      ...rows.map((row, i) =>
        h(EntryRow, {
          key: row._key ?? i,
          row,
          items,
          onPatch: patch => patchRow(i, patch),
          onRemove: () => removeRow(i),
          canRemove: rows.length > 1,
        })
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'dbt dbt--sm',
          'data-add-entry': true,
          onClick: addRow,
          style: 'margin-top:6px;',
        },
        '+ Add entry'
      ),
    ]),
    h('div', { class: 'form-actions' }, [
      h(
        'button',
        { type: 'button', class: 'dbt', 'data-modal-close': true, onClick: onClose },
        'Cancel'
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'dbt btn-primary',
          id: 'table-submit',
          onClick: submit,
        },
        isEdit ? 'Save' : 'Create'
      ),
    ]),
  ]);
}

export function showTableForm(ui, editId = null) {
  const existing = editId ? ui.state.tables.get(editId) : null;
  const isEdit = !!existing;

  return openModal((close) =>
    h(Modal, {
      id: 'table-form-modal',
      title: isEdit ? 'Edit Rollable Table' : 'New Rollable Table',
      autoFocusSelector: '#table-name',
      onClose: close,
    }, h(TableForm, { ui, editId, onClose: close })),
  );
}

