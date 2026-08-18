/**
 * Field dispatcher for `character_form.fields[]`.
 * Input IDs follow `entity-<id-with-dashes>`.
 */

import { h } from 'preact';
import { dispatchSections } from './section-dispatcher.js';
import { AttributeInputs } from './AttributeInputs.jsx';

function idFor(id) {
  return `entity-${String(id).replace(/_/g, '-')}`;
}

function FieldText({ config, entity, isEdit }) {
  const htmlId = idFor(config.id);
  const value = isEdit ? (entity[config.id] ?? '') : (config.default ?? '');
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: htmlId }, config.label),
    h('input', {
      type: 'text', class: 'form-input', id: htmlId,
      'data-field-id': config.id,
      placeholder: config.placeholder ?? '', value,
    }),
  ]);
}

function FieldNumber({ config, entity, isEdit }) {
  const htmlId = idFor(config.id);
  const value = isEdit ? (entity[config.id] ?? config.default ?? 0) : (config.default ?? 0);
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: htmlId }, config.label),
    h('input', {
      type: 'number', class: 'form-input', id: htmlId,
      'data-field-id': config.id,
      value, min: config.min, max: config.max, step: config.step,
    }),
  ]);
}

function FieldTextarea({ config, entity, isEdit }) {
  const htmlId = idFor(config.id);
  const value = isEdit ? (entity[config.id] ?? '') : (config.default ?? '');
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: htmlId }, config.label),
    h('textarea', {
      class: 'form-textarea', id: htmlId,
      'data-field-id': config.id,
      placeholder: config.placeholder ?? '',
      rows: config.rows ?? 3,
    }, value),
  ]);
}

function FieldRow({ ui, config, entity, isEdit }) {
  const nested = dispatchSections(KINDS, config.fields, (sub, i) => ({
    key: i, ui, config: sub, entity, isEdit,
  }));
  if (nested.length === 0) return null;
  return h('div', { class: 'form-row' }, nested);
}

function FieldAttributes({ ui, entity, isEdit }) {
  return h('div', { style: 'display:contents' }, [
    h('div', { class: 'section-header' }, 'Attributes'),
    h(AttributeInputs, { ui, existing: isEdit ? (entity.attributes || {}) : {} }),
  ]);
}

const KINDS = {
  text:       FieldText,
  number:     FieldNumber,
  textarea:   FieldTextarea,
  row:        FieldRow,
  attributes: FieldAttributes,
};

export function renderFormFields(ui, entity, isEdit) {
  const fields = ui.state.settings?.systemConfig?.character_form?.fields;
  return dispatchSections(KINDS, fields, (config, i) => ({
    key: i, ui, config, entity, isEdit,
  }));
}
