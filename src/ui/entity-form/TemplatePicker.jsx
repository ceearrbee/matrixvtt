/**
 * Template-loader dropdown for the EntityForm. Only renders when the
 * active ruleset declares character_templates.
 */
import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { settingsSignal } from '../../state/signals.js';
import { getCharacterTemplates } from '../character-templates.js';
import { TrashIcon } from '../icons/index.jsx';

export function TemplatePicker({ ui }) {
  settingsSignal.value;
  const selectRef = useRef(null);
  const templates = getCharacterTemplates(ui.state.settings);
  if (!templates.length) return null;
  const onDelete = () => {
    const v = selectRef.current?.value;
    if (v != null && v !== '') ui.deleteCharacterTemplate(v);
  };
  return h('div', { class: 'form-group', id: 'template-picker', style: 'border-bottom:1px solid var(--color-border);padding-bottom:var(--space-xl);margin-bottom:var(--space-xl);' }, [
    h('label', { class: 'form-label', for: 'template-select' }, 'Load from Template'),
    h('div', { style: 'display:flex;gap:var(--space-md);align-items:center;' }, [
      h('select', {
        ref: selectRef,
        class: 'form-select', id: 'template-select', style: 'flex:1;',
        onChange: (e) => ui.applyCharacterTemplate(e.target.value),
      }, [
        h('option', { value: '' }, '- select template -'),
        ...templates.map((t, i) => h('option', { value: i }, t.name)),
      ]),
      h('button', {
        type: 'button', class: 'dbt dbt--sm', id: 'delete-template-btn',
        title: 'Delete selected template', 'aria-label': 'Delete selected template',
        style: 'color:var(--color-text-danger);',
        onClick: onDelete,
      }, h(TrashIcon, {})),
    ]),
    h('small', { style: 'font-size:11px;color:var(--color-text-tertiary);' }, 'Applying a template pre-fills the form - you can still edit any field.'),
  ]);
}
