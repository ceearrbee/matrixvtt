/**
 * spells-tab.js - Spell tab component and rendering.
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import * as v from 'valibot';
import { FormReader, applyFieldErrors } from '../utils/ui-helpers.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { reqText, intRange } from '../utils/form-schemas.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { saveChildEntity, confirmDeleteChildEntity, saveCharacterField } from './child-entity-crud.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { showIconPicker } from './icon-picker/IconPickerModal.jsx';

/**
 * Find the character's single active concentration spell (level ≥ 1, prepared, concentration=true).
 * Returns { id, spell } or null.
 */
export function getConcentratingSpell(character, spells) {
  for (const id of (character.spell_ids ?? [])) {
    const spell = spells.get(id);
    if (spell && spell.level >= 1 && spell.concentration && spell.prepared) {
      return { id, spell };
    }
  }
  return null;
}

export async function toggleSpellSlotPip(ui, level, index, used, total) {
  const character = ui.state.getCurrentCharacter();
  if (!character || !ui.state.canEditEntity(character)) return;
  const charId    = ui.state.getCurrentCharacterId();
  const newUsed   = index < used ? used - 1 : Math.min(total, index + 1);
  const spellSlots = { ...character.spell_slots };
  spellSlots[String(level)] = { total, used: Math.max(0, newUsed) };
  const updated = { ...character, spell_slots: spellSlots };
  await saveCharacterField(ui, charId, updated, 'Failed to update spell slots');
}

const SPELL_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

function textRow(id, labelText, placeholder, value, title) {
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: id }, labelText),
    h('input', { type: 'text', class: 'form-input', id, placeholder, defaultValue: value, title }),
  ]);
}

function SpellForm({ ui, spellId, onClose }) {
  const isEdit = spellId !== null;
  const spell = isEdit ? ui.state.spells.get(spellId) : null;
  const formRef = useRef(null);

  const pickIcon = () => showIconPicker({
    onSelect: (url) => {
      const input = formRef.current?.querySelector('#spell-image-url');
      if (input) input.value = url;
    },
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = isEdit ? await ui.updateSpell(form, spellId) : await ui.createSpell(form);
    if (ok !== false) onClose();
  };

  const levelSelected = (l) => isEdit ? spell.level === l : l === 0;
  const schoolKnown = isEdit && SPELL_SCHOOLS.includes(spell.school ?? '');

  return h('form', { id: 'spell-form', ref: formRef, onSubmit }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'spell-name' }, ['Spell Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { type: 'text', class: 'form-input', id: 'spell-name', defaultValue: isEdit ? spell.name : '', required: true, 'aria-required': 'true', title: 'The name of the spell' }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'spell-image-url' }, 'Icon (optional)'),
      h('div', { style: 'display:flex;gap:6px;align-items:center;' }, [
        isEdit && spell.image_url && h('img', { src: spell.image_url, alt: '', style: 'width:32px;height:32px;object-fit:contain;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-sm);' }),
        h('input', { type: 'text', class: 'form-input', id: 'spell-image-url', placeholder: 'Paste a URL or browse the library…', defaultValue: isEdit && spell.image_url ? spell.image_url : '', style: 'flex:1;' }),
        h('button', { type: 'button', class: 'dbt dbt--sm', id: 'spell-pick-icon', title: 'Browse the built-in icon library', onClick: pickIcon }, '🗃 Library'),
      ]),
    ]),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'spell-level' }, 'Level'),
        h('select', { class: 'form-select', id: 'spell-level', title: 'The spell level (0 for cantrips)' }, [
          h('option', { value: '0', selected: levelSelected(0) }, 'Cantrip (0)'),
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => h('option', { value: String(l), selected: levelSelected(l) }, String(l))),
        ]),
      ]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'spell-school' }, 'School'),
        h('select', { class: 'form-select', id: 'spell-school', title: 'The school of magic' }, [
          ...SPELL_SCHOOLS.map((s) => h('option', { value: s, selected: isEdit && spell.school === s }, s)),
          h('option', { value: 'Custom', selected: isEdit && !schoolKnown }, 'Custom'),
        ]),
      ]),
    ]),
    h('div', { class: 'form-row' }, [
      textRow('spell-casting-time', 'Casting Time', '1 action', isEdit ? (spell.casting_time ?? '') : '', 'Time required to cast the spell'),
      textRow('spell-range', 'Range', '30 feet', isEdit ? (spell.range ?? '') : '', 'Maximum distance of the spell effect'),
    ]),
    h('div', { class: 'form-row' }, [
      textRow('spell-duration', 'Duration', 'Instantaneous', isEdit ? (spell.duration ?? '') : '', 'How long the spell effect lasts'),
      textRow('spell-components', 'Components', 'V, S, M (…)', isEdit ? (spell.components ?? '') : '', 'Verbal, Somatic, and Material requirements'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'spell-description' }, 'Description'),
      h('textarea', { class: 'form-textarea', id: 'spell-description', rows: '4', title: 'Detailed spell effect and flavor text', defaultValue: isEdit ? (spell.description ?? '') : '' }),
    ]),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label', title: 'Whether the spell requires ongoing concentration' }, [
          h('input', { type: 'checkbox', id: 'spell-concentration', defaultChecked: isEdit && !!spell.concentration, 'aria-label': 'Concentration' }),
          'Concentration',
        ])),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label', title: 'Whether the spell can be cast as a ritual (+10 mins)' }, [
          h('input', { type: 'checkbox', id: 'spell-ritual', defaultChecked: isEdit && !!spell.ritual, 'aria-label': 'Ritual' }),
          'Ritual',
        ])),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'spell-higher-level' }, 'At Higher Levels (Optional)'),
      h('textarea', { class: 'form-textarea', id: 'spell-higher-level', rows: '2', placeholder: 'When cast using a spell slot of 4th level or higher…', title: 'Scaling effects when using higher level slots', defaultValue: isEdit ? (spell.higher_level ?? '') : '' }),
    ]),
    h('div', { class: 'form-row' }, [
      textRow('spell-source', 'Source', 'PHB', isEdit ? (spell.source ?? '') : '', 'The book or source of the spell'),
      textRow('spell-page', 'Page', '241', isEdit ? (spell.page ?? '') : '', 'The page number in the source book'),
    ]),
    h('div', { class: 'section-header' }, 'Damage / Save (Optional)'),
    h('div', { class: 'form-row' }, [
      textRow('spell-damage', 'Damage', '8d6', isEdit ? (spell.damage ?? '') : '', 'Damage dice formula'),
      textRow('spell-damage-type', 'Type', 'fire', isEdit ? (spell.damage_type ?? '') : '', 'Damage type (e.g. fire, cold)'),
      textRow('spell-save', 'Save', 'dex', isEdit ? (spell.save_ability ?? '') : '', 'The saving throw required by targets'),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true, 'aria-label': 'Cancel and close', title: 'Cancel changes' }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary', 'aria-label': isEdit ? 'Save spell' : 'Add spell', title: isEdit ? 'Save changes' : 'Add a new spell' }, isEdit ? 'Save Spell' : 'Add Spell'),
    ]),
  ]);
}

export function showSpellForm(ui, spellId = null) {
  const isEdit = spellId !== null;
  openModal((close) =>
    h(Modal, { id: 'spell-form-modal', title: isEdit ? 'Edit Spell' : 'Add Spell', maxWidth: '520px', autoFocusSelector: '#spell-name', onClose: close },
      h(SpellForm, { ui, spellId, onClose: close }),
    ),
  );
}

export function getSpellFormSchema() {
  const fields = {
    name:          { id: 'spell-name' },
    level:         { id: 'spell-level', type: 'int' },
    school:        'spell-school',
    casting_time:  'spell-casting-time',
    range:         'spell-range',
    duration:      'spell-duration',
    components:    'spell-components',
    description:   'spell-description',
    damage:        'spell-damage',
    damage_type:   'spell-damage-type',
    save_ability:  'spell-save',
    concentration: { id: 'spell-concentration', type: 'bool' },
    ritual:        { id: 'spell-ritual', type: 'bool' },
    higher_level:  'spell-higher-level',
    source:        'spell-source',
    page:          'spell-page',
    image_url:     { id: 'spell-image-url' },
  };
  const schema = v.object({
    name:  reqText('Spell name'),
    level: intRange('Level', 0, 9),
  });
  return { fields, schema };
}

export async function createSpell(ui, modal) {
  const character = ui.state.getCurrentCharacter();
  if (!character) { ui._toast('No character selected', 'info'); return false; }

  const { fields, schema } = getSpellFormSchema();
  const { values: spell, errors } = new FormReader(modal).validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  spell.prepared = false;

  const spellId = await allocateEntityId('spl', ui.state.spells);
  const charId  = ui.state.getCurrentCharacterId();
  const updated = { ...character, spell_ids: [...(character.spell_ids ?? []), spellId] };

  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.SPELL,
    id: spellId, entity: spell, noun: 'spell', verb: 'create',
    parentUpdate: { charId, updated },
  });
  return true;
}

export async function updateSpell(ui, modal, spellId) {
  const existing = ui.state.spells.get(spellId);
  if (!existing) return false;
  const { fields, schema } = getSpellFormSchema();
  const { values, errors } = new FormReader(modal).validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const spell = { ...existing, ...values };
  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.SPELL,
    id: spellId, entity: spell, noun: 'spell', verb: 'update',
  });
  return true;
}

export async function deleteSpell(ui, spellId) {
  const spell = ui.state.spells.get(spellId);
  confirmDeleteChildEntity(ui, {
    eventType: EVENT_TYPES.SPELL,
    id: spellId, noun: 'spell', entityName: spell?.name,
    parentLinkField: 'spell_ids',
  });
}

export async function toggleSpellPrepared(ui, spellId) {
  const spell = ui.state.spells.get(spellId);
  if (!spell || !ui.state.canEditEntity(ui.state.getCurrentCharacter())) return;
  const updated = { ...spell, prepared: !spell.prepared };
  await saveChildEntity(ui, {
    eventType: EVENT_TYPES.SPELL,
    id: spellId, entity: updated, noun: 'spell', verb: 'save',
  });
}
