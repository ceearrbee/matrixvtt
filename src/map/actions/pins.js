/**
 * Pin actions - Add Pin Here form, Edit, Remove. Pins are persistent
 * named annotations placed by the GM. Storage + render lives in
 * `src/state/writers/world-writers.js` and `src/map/layers/pins.js`.
 */

import { h } from 'preact';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { emitVttError as emitError } from '../../utils/errorHandling.js';
import { allocateEntityId } from '../../utils/stable-id.js';

const FORM_ID = 'pin-form-modal';
const DEFAULT_COLOR = '#e6c84a';

function PinForm({ submitLabel, label = '', color = DEFAULT_COLOR, gmOnly = true, onSubmit, onClose }) {
  const submit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const labelVal = String(data.get('label') || '').trim();
    if (!labelVal) return;
    const colorVal = String(data.get('color') || DEFAULT_COLOR);
    const gm_only = data.get('gm_only') === 'on';
    onClose();
    try { await onSubmit({ label: labelVal, color: colorVal, gm_only }); }
    catch (err) { emitError('Failed to save pin', err); }
  };

  return h('form', { 'data-pin-form': true, onSubmit: submit }, [
    h('label', { class: 'form-label', for: 'pin-label-input' }, 'Label'),
    h('input', { id: 'pin-label-input', name: 'label', class: 'form-input', type: 'text', defaultValue: label, placeholder: "What's here?", autocomplete: 'off', required: true }),
    h('label', { class: 'form-label', for: 'pin-color-input', style: 'margin-top: 12px;' }, 'Color'),
    h('input', { id: 'pin-color-input', name: 'color', type: 'color', defaultValue: color }),
    h('label', { style: 'display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: var(--font-size-sm);' }, [
      h('input', { type: 'checkbox', name: 'gm_only', defaultChecked: gmOnly }),
      'Only visible to GMs',
    ]),
    h('div', { class: 'form-actions', style: 'margin-top: 16px;' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary' }, submitLabel),
    ]),
  ]);
}

export function showPinForm(mr, col, row) {
  if (!mr.state?.isGM?.()) return;
  openModal((close) =>
    h(Modal, { id: FORM_ID, title: 'Add Pin', maxWidth: '360px', autoFocusSelector: '#pin-label-input', onClose: close },
      h(PinForm, {
        submitLabel: 'Add Pin', onClose: close,
        onSubmit: async ({ label, color, gm_only }) => {
          const id = await allocateEntityId('pin', mr.state.pins);
          await mr.state.addPin({ id, col, row, label, color, gm_only });
        },
      })),
  );
}

export function showEditPinForm(mr, pin) {
  if (!mr.state?.isGM?.()) return;
  openModal((close) =>
    h(Modal, { id: FORM_ID, title: 'Edit Pin', maxWidth: '360px', autoFocusSelector: '#pin-label-input', onClose: close },
      h(PinForm, {
        submitLabel: 'Save', label: pin.label, color: pin.color || DEFAULT_COLOR, gmOnly: !!pin.gm_only, onClose: close,
        onSubmit: async ({ label, color, gm_only }) => {
          await mr.state.updatePin(pin.id, { label, color, gm_only });
        },
      })),
  );
}

export async function removePin(mr, pinId) {
  if (!mr.state?.isGM?.()) return;
  try { await mr.state.removePin(pinId); }
  catch (err) { emitError('Failed to remove pin', err); }
}
