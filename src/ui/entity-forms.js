/**
 * entity-forms.js - DOM helpers for the entity form. Preact modal lives in
 * EntityForm.jsx; this module retains pure helpers consumed by tests and
 * entity-manager.js.
 */

import { esc } from '../utils/component.js';
import { getCharacterTemplates } from './character-templates.js';

export function collectNPCExtendedFields(modal) {
  const val = (id) => modal.querySelector(`#${id}`)?.value?.trim() ?? '';
  const num = (id) => parseInt(modal.querySelector(`#${id}`)?.value ?? '0', 10) || 0;
  return {
    senses:               val('npc-senses'),
    languages:            val('npc-languages'),
    alignment:            val('npc-alignment'),
    creature_type:        val('npc-creature-type'),
    multiattack:          val('npc-multiattack'),
    damage_resistances:   val('npc-damage-resistances'),
    damage_immunities:    val('npc-damage-immunities'),
    condition_immunities: val('npc-condition-immunities'),
    legendary_actions_count: num('npc-legendary-count'),
  };
}

export function renderTemplatePicker(ui) {
  const templates = getCharacterTemplates(ui.state.settings);
  if (templates.length === 0) return '';
  const opts = templates.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  return `
    <div class="form-group" id="template-picker" style="border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: 12px;">
      <label class="form-label" for="template-select">Load from Template</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <select class="form-select" id="template-select" style="flex:1;">
          <option value="">- select template -</option>
          ${opts}
        </select>
        <button type="button" class="dbt dbt--sm" title="Delete selected template" id="delete-template-btn"
                aria-label="Delete selected template"
                style="color:var(--color-text-danger);">🗑</button>
      </div>
      <small style="font-size:11px;color:var(--color-text-tertiary);">Applying a template pre-fills the form - you can still edit any field.</small>
    </div>`;
}

// The real `setupTemplatePickerHandlers` lives on
// `ui._setupTemplatePickerHandlers` (ui-methods.js); no stub here.
