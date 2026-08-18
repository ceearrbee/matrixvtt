/**
 * EntityForm.jsx - Character/NPC create/edit modal.
 * Form uses uncontrolled inputs; submit logic in entity-manager reads the DOM.
 */

import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { trapFocusIn } from '../utils/ui-helpers.js';
import { VTTError, ErrorType, showErrorNotification } from '../utils/errorHandling.js';
import { ENTITY_TYPES } from '../utils/constants.js';

import { renderFormFields } from './characterFormFields.js';
import { AttributeInputs } from './AttributeInputs.jsx';
import { TemplatePicker } from './entity-form/TemplatePicker.jsx';
import { SpellcastingFields } from './entity-form/SpellcastingFields.jsx';
import { NPCFields, NPCMonsterDetails, NPCActions } from './entity-form/NPCFields.jsx';
import { PortraitField } from './entity-form/PortraitField.jsx';
import { rulesetTracksHP, rulesetHasFormField } from './entity-form/system-fields.js';

function TypeSelector({ isPC, onChange }) {
  return h('div', { class: 'form-group', style: 'border-bottom:1px solid var(--color-border);padding-bottom:16px;margin-bottom:16px;' }, [
    h('label', { class: 'form-label' }, 'Entity Type'),
    h('div', { style: 'display:flex;gap:16px;margin-top:8px;' }, [
      h('label', { style: 'display:flex;align-items:center;cursor:pointer;' }, [
        h('input', { type: 'radio', name: 'entity-type', value: ENTITY_TYPES.PC, checked: isPC, onChange: (e) => onChange(e.target.value), style: 'margin-right:6px;' }),
        h('span', { style: 'font-size:13px;' }, 'Player Character'),
      ]),
      h('label', { style: 'display:flex;align-items:center;cursor:pointer;' }, [
        h('input', { type: 'radio', name: 'entity-type', value: ENTITY_TYPES.NPC, checked: !isPC, onChange: (e) => onChange(e.target.value), style: 'margin-right:6px;' }),
        h('span', { style: 'font-size:13px;' }, 'NPC/Monster'),
      ]),
    ]),
  ]);
}

function CommonBottomFields({ ui, entity, isEdit }) {
  const systemConfig = ui.state.settings?.systemConfig;
  const showHP = rulesetTracksHP(systemConfig);
  const showAC = rulesetHasFormField(systemConfig, 'ac');
  const showSpeed = rulesetHasFormField(systemConfig, 'speed');
  return h('div', null, [
    (showHP || showAC || showSpeed) && h('div', { class: 'form-row' }, [
      showHP && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-hp-max' }, 'HP Max'),
        h('input', { type: 'number', class: 'form-input', id: 'entity-hp-max', value: isEdit ? entity.hp_max : 30, min: 1 }),
      ]),
      showAC && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-ac' }, 'AC'),
        h('input', { type: 'number', class: 'form-input', id: 'entity-ac', value: isEdit ? entity.ac : 10, min: 0 }),
      ]),
      showSpeed && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-speed' }, 'Speed'),
        h('input', { type: 'number', class: 'form-input', id: 'entity-speed', value: isEdit ? entity.speed : 30, min: 0 }),
      ]),
    ]),
    h('div', { class: 'section-header' }, 'Attributes'),
    h(AttributeInputs, { ui, existing: isEdit ? entity.attributes : {} }),
  ]);
}

function EntityFormModal({ ui, initialType, entityId, trigger, onClose }) {
  const [entityType, setEntityType] = useState(initialType || ENTITY_TYPES.PC);
  const isEdit = !!entityId;
  const isPC = entityType === ENTITY_TYPES.PC;
  const entity = isEdit ? (isPC ? ui.state.characters.get(entityId) : ui.state.npcs.get(entityId)) : null;

  const close = () => { onClose(); trigger?.focus(); };

  const onSubmit = async (e) => {
    e.preventDefault();
    const container = e.currentTarget.closest('.modal-overlay');
    try {
      let ok;
      if (isPC) {
        ok = isEdit ? await ui.updateCharacter(container, entityId) : await ui.createCharacter(container);
      } else {
        ok = isEdit ? await ui.updateNPC(container, entityId) : await ui.createNPC(container);
      }
      if (ok !== false) close();
    } catch (err) { showErrorNotification(new VTTError(ErrorType.UNKNOWN, err.message, err)); }
  };

  return h('div', {
    class: 'modal-overlay',
    id: 'entity-form-modal',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
    onKeyDown: (e) => { if (e.key === 'Escape') close(); },
  },
    h('div', {
      class: 'modal-content', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'entity-form-title', style: 'max-width:650px;max-height:90vh;overflow-y:auto;',
    }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: 'entity-form-title' }, isEdit ? `Edit ${isPC ? 'Character' : 'NPC/Monster'}` : 'Add Character/NPC'),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: close }, '✕'),
      ]),
      h('div', { class: 'modal-body' },
        h('form', { id: 'entity-form', 'data-entity-type': entityType, onSubmit }, [
          !isEdit && isPC && h(TemplatePicker, { ui }),
          !isEdit && h(TypeSelector, { isPC, onChange: setEntityType }),
          h('div', { class: 'form-group' }, [
            h('label', { class: 'form-label', for: 'entity-name' }, [
              h('span', { class: 'entity-type-pc', style: `display:${isPC ? '' : 'none'};` }, 'Character Name'),
              h('span', { class: 'entity-type-npc', style: `display:${isPC ? 'none' : ''};` }, 'NPC/Monster Name'),
              ' ', h('span', { 'aria-hidden': 'true' }, '*'),
            ]),
            h('input', {
              type: 'text', class: 'form-input', id: 'entity-name',
              placeholder: isPC ? 'e.g., Aria Blackwood' : 'e.g., Orc War Boss',
              value: isEdit ? entity.name : '', required: true, 'aria-required': 'true',
            }),
          ]),
          h(PortraitField, { initial: isEdit ? entity?.image_url : '' }),
          isPC
            ? h('div', { class: 'entity-fields-pc' }, [
                ...renderFormFields(ui, entity, isEdit),
                h(SpellcastingFields, { ui, entity, isPC, isEdit }),
              ])
            : h('div', { style: 'display:contents' }, [
                h(NPCFields, { ui, entity, isPC, isEdit }),
                h(CommonBottomFields, { ui, entity, isEdit }),
                h(NPCMonsterDetails, { ui, entity, isPC, isEdit }),
              ]),
          h(NPCActions, { entity, isPC, isEdit }),
          h('div', { class: 'form-actions' }, [
            h('button', { type: 'button', class: 'dbt', onClick: close }, 'Cancel'),
            h('button', { type: 'submit', class: 'dbt btn-primary', id: 'entity-submit-btn' }, [
              isEdit ? 'Update ' : 'Create ',
              h('span', { class: 'submit-entity-type' }, isPC ? (isEdit ? 'Character' : 'Character') : 'NPC'),
            ]),
          ]),
        ])),
    ]));
}

export function showEntityForm(ui, entityType = ENTITY_TYPES.PC, entityId = null) {
  // Clean up any stale overlay (e.g. from a prior render that errored mid-way)
  // so subsequent edit clicks aren't silently swallowed by the guard. This is
  // a Preact-rendered custom overlay (not a ModalFactory modal), so the
  // factory's cleanup pipeline does not apply.
  // eslint-disable-next-line vtt/no-direct-modal-remove
  document.getElementById('entity-form-modal')?.remove();
  const trigger = document.activeElement;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const onClose = () => { render(null, host); host.remove(); };
  render(h(EntityFormModal, { ui, initialType: entityType, entityId, trigger, onClose }), host);
  const overlay = /** @type {HTMLElement|null} */ (host.querySelector('.modal-overlay'));
  if (overlay) {
    trapFocusIn(overlay);
    /** @type {HTMLElement|null} */ (overlay.querySelector('input, select, button'))?.focus();
  }
}
