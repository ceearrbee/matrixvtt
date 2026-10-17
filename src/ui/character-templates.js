/**
 * character-templates.js - Save/delete character templates stored in settings.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';

/**
 * Templates persist at settings.character_templates. The legacy
 * location inside systemConfig is read as a fallback only: builtin
 * systems strip systemConfig on write, so anything stored there is
 * wiped by the next settings apply.
 */
export function getCharacterTemplates(settings) {
  return settings?.character_templates
    ?? settings?.systemConfig?.character_templates
    ?? [];
}

export function addTemplateToSettings(settings, template) {
  return {
    ...settings,
    character_templates: [...getCharacterTemplates(settings), template],
  };
}

export function removeTemplateFromSettings(settings, index) {
  const templates = [...getCharacterTemplates(settings)];
  templates.splice(parseInt(index), 1);
  return { ...settings, character_templates: templates };
}

function _buildTemplateFromCharacter(name, character) {
  const skillsText = character.skills
    ? Object.entries(character.skills).map(([k, v]) => `${k.replace(/_/g, ' ')}:${v}`).join(', ')
    : '';

  return {
    name,
    class_level: character.class_level || '',
    species: character.species || '',
    hp_max: character.hp_max,
    ac: character.ac,
    speed: character.speed,
    initiative_bonus: character.initiative_bonus ?? 0,
    attributes: { ...character.attributes },
    skills: skillsText,
    notes: character.notes || ''
  };
}

function SaveTemplateForm({ ui, character, defaultName, onClose }) {
  const inputRef = useRef(null);

  const save = async () => {
    const name = (inputRef.current?.value ?? '').trim();
    if (!name) return;
    const template = _buildTemplateFromCharacter(name, character);
    await ui.state.updateSettings(addTemplateToSettings(ui.state.settings, template));
    onClose();
    ui._toast(`Template "${name}" saved`, 'success');
  };

  return h('div', null, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'template-name-input' }, 'Template Name'),
      h('input', {
        type: 'text', class: 'form-input', id: 'template-name-input',
        ref: inputRef, defaultValue: defaultName,
        placeholder: 'e.g., Fighter (STR build)',
        onKeyDown: (e) => { if (e.key === 'Enter') save(); },
      }),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { type: 'button', class: 'dbt btn-primary', id: 'confirm-template-btn', onClick: save }, 'Save Template'),
    ]),
  ]);
}

export async function saveCharacterAsTemplate(ui, charId) {
  const character = ui.state.characters.get(charId);
  if (!character) return;
  const defaultName = character.class_level
    ? `${character.class_level} Template`
    : `${character.name} Template`;

  openModal((close) => h(Modal, {
    id: 'save-template-modal',
    title: 'Save as Template',
    maxWidth: '380px',
    autoFocusSelector: '#template-name-input',
    onClose: close,
  }, h(SaveTemplateForm, { ui, character, defaultName, onClose: close })));
}

export async function deleteCharacterTemplate(ui, index) {
  await ui.state.updateSettings(removeTemplateFromSettings(ui.state.settings, index));
}
