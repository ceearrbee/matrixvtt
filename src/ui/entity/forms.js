/**
 * forms.js - character + NPC create/update from a modal form.
 * Field collection and NPC-action parsing are DOM-facing helpers
 * that live here because they only exist to feed these flows.
 */

import * as v from 'valibot';
import { FormReader, applyFieldErrors } from '../../utils/ui-helpers.js';
import { reqText, intRange, optInt } from '../../utils/form-schemas.js';
import { collectNPCExtendedFields } from '../entity-forms.js';
import { EVENT_TYPES, ENTITY_TYPES } from '../../utils/constants.js';
import { allocateEntityId } from '../../utils/stable-id.js';
import { saveEntity } from './_save.js';
import { rulesetTracksHP, rulesetHasFormField } from '../entity-form/system-fields.js';

// FormReader returns blank numerics as 0, so fields the ruleset hides
// (and the form never rendered) must be dropped or every Risus NPC
// would be saved with hp_max: 0, ac: 0, speed: 0.
function stripHiddenSystemFields(data, systemConfig) {
  const out = { ...data };
  if (!rulesetTracksHP(systemConfig)) {
    delete out.hp_max; delete out.hp_current; delete out.hp_temp;
  }
  if (!rulesetHasFormField(systemConfig, 'ac')) delete out.ac;
  if (!rulesetHasFormField(systemConfig, 'speed')) delete out.speed;
  return out;
}

export function getPCSchema(systemConfig) {
  const fields = {
    name:                 { ids: ['entity-name', 'char-name'] },
    species:              { ids: ['entity-species', 'char-species'] },
    class_level:          { ids: ['entity-class-level', 'entity-class', 'char-class'] },
    level:                { ids: ['entity-level'], type: 'int' },
    xp_current:           { ids: ['entity-xp-current'], type: 'int' },
    xp_next_level:        { ids: ['entity-xp-next-level'], type: 'int' },
    hp_max:               { ids: ['entity-hp-max', 'char-hp-max'], type: 'int' },
    hp_current:           { ids: ['entity-hp-current', 'char-hp-current'], type: 'int' },
    hp_temp:              { ids: ['entity-hp-temp'], type: 'int' },
    ac:                   { ids: ['entity-ac', 'char-ac'], type: 'int' },
    speed:                { ids: ['entity-speed', 'char-speed'], type: 'int' },
    initiative_bonus:     { ids: ['entity-initiative-bonus', 'entity-init', 'char-init'], type: 'int' },
    notes:                { ids: ['entity-notes', 'char-notes'] },
    spellcasting_ability: { id: 'entity-spellcasting-ability' },
    // Identity / personality - all optional strings. The form may
    // present them as text, textarea, or select; the reader just
    // pulls whatever the matching DOM element holds.
    alignment:            { ids: ['entity-alignment'] },
    background:           { ids: ['entity-background'] },
    ideals:               { ids: ['entity-ideals'] },
    bonds:                { ids: ['entity-bonds'] },
    flaws:                { ids: ['entity-flaws'] },
    image_url:            { ids: ['entity-image-url'] },
  };
  const schema = v.object({
    name:          reqText('Name'),
    level:         intRange('Level', 1, 20),
    xp_current:    optInt('XP', 0),
    xp_next_level: optInt('XP to Next', 0),
    // hp_max is required only when the active ruleset tracks HP; the
    // form hides the input for systems that don't, and a required
    // validator against an absent input blocks creation silently.
    hp_max:        intRange('HP Max', 1, undefined, { required: rulesetTracksHP(systemConfig) }),
    hp_current:    optInt('HP', 0),
    hp_temp:       optInt('Temp HP', 0),
    ac:            intRange('AC', 0, 40),
    speed:         intRange('Speed', 0, 200),
  });
  return { fields, schema };
}

export function getNPCSchema(systemConfig) {
  const fields = {
    name:          { ids: ['entity-name', 'npc-name'] },
    cr:            { ids: ['entity-cr', 'npc-cr'] },
    size_category: { ids: ['entity-size', 'npc-size'] },
    hp_max:        { ids: ['entity-hp-max', 'npc-hp-max'], type: 'int' },
    ac:            { ids: ['entity-ac', 'npc-ac'], type: 'int' },
    speed:         { ids: ['entity-speed', 'npc-speed'], type: 'int' },
    is_hidden:     { ids: ['entity-hidden', 'npc-hidden'], type: 'bool' },
    image_url:     { ids: ['entity-image-url'] },
  };
  const schema = v.object({
    name:   reqText('Name'),
    hp_max: intRange('HP Max', 1, undefined, { required: rulesetTracksHP(systemConfig) }),
    ac:     intRange('AC', 0, 40),
    speed:  intRange('Speed', 0, 200),
  });
  return { fields, schema };
}

export async function createCharacter(ui, modal) {
  const form = new FormReader(modal);
  const { fields, schema } = getPCSchema(ui.state.settings?.systemConfig);
  const { values: rawValues, errors } = form.validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const values = stripHiddenSystemFields(rawValues, ui.state.settings?.systemConfig);

  const charId = await allocateEntityId('chr', ui.state.characters);
  const slots = ui._collectSpellSlots(modal);
  const character = {
    ...values,
    attributes: ui._collectAttributeValues(modal),
    skills: _parseSkillsField(form),
    actions: _parseActions(modal),
    spell_slots: Object.keys(slots).length ? slots : undefined,
    id: charId, type: ENTITY_TYPES.PC, player_user_id: ui.widgetManager.userId,
    token_id: null, skill_proficiencies: [], skill_expertise: [],
    saving_throws: {}, conditions: [], inventory_ids: [], spell_ids: [],
  };

  await saveEntity(ui, EVENT_TYPES.CHARACTER, charId, character);
  return true;
}

export async function updateCharacter(ui, modal, charId) {
  const existing = ui.state.characters.get(charId);
  if (!existing) return false;

  const form = new FormReader(modal);
  const { fields, schema } = getPCSchema(ui.state.settings?.systemConfig);
  const { values: rawValues, errors } = form.validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const values = stripHiddenSystemFields(rawValues, ui.state.settings?.systemConfig);

  const slots = ui._collectSpellSlots(modal);
  const character = {
    ...existing,
    ...values,
    attributes: ui._collectAttributeValues(modal),
    skills: _parseSkillsField(form),
    actions: _parseActions(modal),
    spell_slots: Object.keys(slots).length ? slots : existing.spell_slots,
    id: charId,
  };

  await saveEntity(ui, EVENT_TYPES.CHARACTER, charId, character);
  return true;
}

export async function createNPC(ui, modal) {
  const form = new FormReader(modal);
  const { fields, schema } = getNPCSchema(ui.state.settings?.systemConfig);
  const { values: rawData, errors } = form.validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const data = stripHiddenSystemFields(rawData, ui.state.settings?.systemConfig);

  const npcId = await allocateEntityId('npc', ui.state.npcs);
  const npc = {
    ...data, id: npcId, type: ENTITY_TYPES.NPC,
    ...(data.hp_max != null ? { hp_current: data.hp_max } : {}),
    attributes: ui._collectAttributeValues(modal), actions: _parseActions(modal),
    notes: '', ...collectNPCExtendedFields(modal),
  };

  await saveEntity(ui, EVENT_TYPES.NPC, npcId, npc);
  return true;
}

export async function updateNPC(ui, modal, npcId) {
  const existing = ui.state.npcs.get(npcId);
  if (!existing) return false;

  const form = new FormReader(modal);
  const { fields, schema } = getNPCSchema(ui.state.settings?.systemConfig);
  const { values: rawData, errors } = form.validate(fields, schema);
  if (Object.keys(errors).length) {
    applyFieldErrors(modal, errors, fields);
    return false;
  }
  const data = stripHiddenSystemFields(rawData, ui.state.settings?.systemConfig);

  const npc = {
    ...existing, ...data, id: npcId,
    ...(data.hp_max != null
      ? { hp_current: Math.min(existing.hp_current ?? data.hp_max, data.hp_max) }
      : {}),
    attributes: ui._collectAttributeValues(modal), actions: _parseActions(modal),
    ...collectNPCExtendedFields(modal),
  };

  await saveEntity(ui, EVENT_TYPES.NPC, npcId, npc);
  return true;
}

function _parseActions(modal) {
  const actions = [];
  const list = modal.querySelector('#entity-actions-list') || modal.querySelector('#npc-actions-list');
  if (list) {
    list.querySelectorAll(':scope > div, :scope > .form-group, :scope > fieldset').forEach(div => {
      const name = div.querySelector('.action-name')?.value;
      if (name) {
        actions.push({
          name, description: div.querySelector('.action-desc')?.value || '',
          attack_bonus: parseInt(div.querySelector('.action-attack')?.value) || null,
          damage: div.querySelector('.action-damage')?.value || null,
          damage_type: div.querySelector('.action-damage-type')?.value || null,
        });
      }
    });
  }
  return actions;
}

function _parseSkillsField(form) {
  const text = form.getField('entity-skills', 'char-skills');
  const skills = {};
  if (text) {
    text.split(',').forEach(pair => {
      const [name, bonus] = pair.split(':').map(s => s.trim());
      if (name && bonus) skills[name.toLowerCase().replace(/\s+/g, '_')] = parseInt(bonus) || 0;
    });
  }
  return skills;
}
