/**
 * skills-tab.js - Skills tab component and rendering.
 */

import { h } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { confirm } from './confirm-dialogs.jsx';
import { saveCharacterField } from './child-entity-crud.js';


export async function cycleSkillProficiency(ui, skillKey) {
  const character = ui.state.getCurrentCharacter();
  if (!character || !ui.state.canEditEntity(character)) return;
  const charId  = ui.state.getCurrentCharacterId();
  const profs   = new Set(character.skill_proficiencies ?? []);
  const experts = new Set(character.skill_expertise ?? []);
  if (experts.has(skillKey)) {
    experts.delete(skillKey);
    profs.delete(skillKey);
  } else if (profs.has(skillKey)) {
    experts.add(skillKey);
  } else {
    profs.add(skillKey);
  }
  const updated = { ...character, skill_proficiencies: Array.from(profs), skill_expertise: Array.from(experts) };
  await saveCharacterField(ui, charId, updated, 'Failed to save skill proficiency');
}

function SkillOverrideForm({ ui, character, existingKey, onClose }) {
  const isEdit = existingKey !== null;
  const existing = isEdit ? (character.skills ?? {})[existingKey] : 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const key = form.querySelector('#skill-key').value.trim().toLowerCase().replace(/\s+/g, '_');
    const bonus = parseInt(form.querySelector('#skill-bonus').value) || 0;
    if (!key) return;
    const charId = ui.state.getCurrentCharacterId();
    const updated = { ...character, skills: { ...character.skills, [key]: bonus } };
    if (await saveCharacterField(ui, charId, updated, 'Failed to save skill override')) {
      onClose();
    }
  };

  return h('form', { id: 'skill-override-form', onSubmit }, [
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'skill-key' }, ['Skill Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
        h('input', { type: 'text', class: 'form-input', id: 'skill-key', defaultValue: isEdit ? existingKey : '', readonly: isEdit, required: true, title: 'The name of the skill' }),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'skill-bonus' }, 'Bonus'),
        h('input', { type: 'number', class: 'form-input', id: 'skill-bonus', defaultValue: existing, style: 'width:80px;', title: 'The total bonus for this skill' }),
      ]),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true, 'aria-label': 'Cancel and close', title: 'Cancel changes' }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary', 'aria-label': isEdit ? 'Update skill' : 'Add skill', title: isEdit ? 'Save changes' : 'Add new skill' }, isEdit ? 'Update' : 'Add Skill'),
    ]),
  ]);
}

export function showAddSkillOverrideForm(ui, existingKey = null) {
  const character = ui.state.getCurrentCharacter();
  if (!character) return;
  const isEdit = existingKey !== null;
  openModal((close) =>
    h(Modal, { id: 'skill-override-modal', title: isEdit ? 'Edit Skill' : 'Add Skill', maxWidth: '360px', autoFocusSelector: '#skill-key', onClose: close },
      h(SkillOverrideForm, { ui, character, existingKey, onClose: close }),
    ),
  );
}

export async function deleteSkillOverride(ui, skillKey) {
  const character = ui.state.getCurrentCharacter();
  if (!character || !ui.state.canEditEntity(character)) return;
  const charId = ui.state.getCurrentCharacterId();
  const label = skillKey.replace(/_/g, ' ');
  confirm(
    h('span', null, ['Delete skill override ', h('strong', null, label), ' from ', h('strong', null, character.name ?? 'this character'), '?']),
    async () => {
      const skills = { ...character.skills };
      delete skills[skillKey];
      const updated = { ...character, skills };
      await saveCharacterField(ui, charId, updated, 'Failed to save character');
    },
    { title: 'Delete Skill Override', confirmText: 'Delete', confirmClass: 'dbt--danger' },
  );
}
