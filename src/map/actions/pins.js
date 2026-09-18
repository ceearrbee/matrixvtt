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

/**
 * Every pin on some other map, as picker options. A pin can only lead
 * somewhere else, so the map being edited is left out - and the
 * destination has to exist first, which is why the field says so.
 */
function destinationOptions(mr, mapId) {
  const maps = mr.state?.maps;
  const options = [];
  for (const [id, pin] of mr.state?.pins ?? []) {
    if (!pin || pin.map_id === mapId) continue;
    const mapName = maps?.get(pin.map_id)?.name || 'Untitled map';
    options.push({ id, label: `${mapName} - ${pin.label || 'Unlabelled pin'}` });
  }
  return options;
}

function PinForm({
  submitLabel, label = '', color = DEFAULT_COLOR, gmOnly = true,
  targetPinId = '', destinations = [], onSubmit, onClose,
}) {
  const submit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const labelVal = String(data.get('label') || '').trim();
    if (!labelVal) return;
    const colorVal = String(data.get('color') || DEFAULT_COLOR);
    const gm_only = data.get('gm_only') === 'on';
    const target_pin_id = String(data.get('target_pin_id') || '');
    onClose();
    try { await onSubmit({ label: labelVal, color: colorVal, gm_only, target_pin_id }); }
    catch (err) { emitError('Failed to save pin', err); }
  };

  return h('form', { 'data-pin-form': true, onSubmit: submit }, [
    h('label', { class: 'form-label', for: 'pin-label-input' }, 'Label'),
    h('input', { id: 'pin-label-input', name: 'label', class: 'form-input', type: 'text', defaultValue: label, placeholder: "What's here?", autocomplete: 'off', required: true }),
    h('label', { class: 'form-label', for: 'pin-color-input', style: 'margin-top: var(--space-xl);' }, 'Color'),
    h('input', { id: 'pin-color-input', name: 'color', type: 'color', defaultValue: color }),
    // Only offered once there is somewhere to go. On a one-map campaign
    // the field would be a disabled control and a paragraph explaining
    // a feature the GM cannot use yet.
    ...(destinations.length ? [
      h('label', { class: 'form-label', for: 'pin-target-input', style: 'margin-top: var(--space-xl);' }, 'Travels to'),
      h('select', {
        id: 'pin-target-input', name: 'target_pin_id', class: 'form-input',
        value: targetPinId,
      }, [
        h('option', { value: '' }, 'Nowhere - just a marker'),
        ...destinations.map((d) => h('option', { key: d.id, value: d.id }, d.label)),
      ]),
      h('p', { class: 'form-hint' },
        'Moving the party through this pin switches everyone to that map and puts their tokens on the pin you chose.'),
    ] : []),
    h('label', { style: 'display: flex; align-items: center; gap: var(--space-md); margin-top: var(--space-xl); font-size: var(--font-size-sm);' }, [
      h('input', { type: 'checkbox', name: 'gm_only', defaultChecked: gmOnly }),
      'Only visible to GMs',
    ]),
    h('div', { class: 'form-actions', style: 'margin-top: var(--space-2xl);' }, [
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
        destinations: destinationOptions(mr, mr.state.activeMapId),
        onSubmit: async ({ label, color, gm_only, target_pin_id }) => {
          const id = await allocateEntityId('pin', mr.state.pins);
          await mr.state.addPin({ id, col, row, label, color, gm_only, target_pin_id });
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
        targetPinId: pin.target_pin_id || '',
        destinations: destinationOptions(mr, pin.map_id),
        onSubmit: async ({ label, color, gm_only, target_pin_id }) => {
          await mr.state.updatePin(pin.id, { label, color, gm_only, target_pin_id });
        },
      })),
  );
}

export async function removePin(mr, pinId) {
  if (!mr.state?.isGM?.()) return;
  try { await mr.state.removePin(pinId); }
  catch (err) { emitError('Failed to remove pin', err); }
}
