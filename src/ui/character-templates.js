/**
 * character-templates.js - Save/delete character templates stored in settings.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { esc } from '../utils/domHelpers.js';

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

export async function saveCharacterAsTemplate(ui, charId) {
  const character = ui.state.characters.get(charId);
  if (!character) return;

  const _trigger = /** @type {HTMLElement|null} */ (document.activeElement);
  const defaultName = character.class_level ? `${character.class_level} Template` : `${character.name} Template`;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'save-template-modal';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="save-template-title" style="max-width:380px;">
      <div class="modal-header">
        <h2 id="save-template-title">Save as Template</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="template-name-input">Template Name</label>
          <input type="text" class="form-input" id="template-name-input"
                 value="${esc(defaultName)}" placeholder="e.g., Fighter (STR build)">
        </div>
        <div class="form-actions">
          <button type="button" class="dbt" id="cancel-template-btn">Cancel</button>
          <button type="button" class="dbt btn-primary" id="confirm-template-btn">Save Template</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => { modal.remove(); _trigger?.focus(); };
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-template-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#confirm-template-btn').addEventListener('click', async () => {
    const name = (modal.querySelector('#template-name-input')?.value ?? '').trim();
    if (!name) return;

    const template = _buildTemplateFromCharacter(name, character);
    await ui.state.updateSettings(addTemplateToSettings(ui.state.settings, template));

    close();
    ui._toast(`Template "${name}" saved`, 'success');
  });

  modal.querySelector('#template-name-input')?.focus();
  modal.querySelector('#template-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') modal.querySelector('#confirm-template-btn')?.click();
  });
}

export async function deleteCharacterTemplate(ui, index) {
  await ui.state.updateSettings(removeTemplateFromSettings(ui.state.settings, index));
  // Refresh template picker if still open
  const picker = document.getElementById('template-picker');
  if (picker) {
    picker.innerHTML = ui._renderTemplatePicker();
  }
}
