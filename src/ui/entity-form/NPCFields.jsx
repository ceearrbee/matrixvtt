/**
 * NPC/monster-only subsections of the EntityForm: top-level
 * CR/size, monster-detail rows, and the dynamic Actions list. Each
 * component returns null when the active ruleset has no matching
 * metadata.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';

export function NPCFields({ ui, entity, isPC, isEdit }) {
  const npc = ui.state.settings.systemConfig?.npc;
  if (!npc) return null;                 // ruleset has no NPC metadata concept
  const currentCr = isEdit && !isPC ? (entity?.cr ?? '') : '';
  const currentSize = isEdit && !isPC ? (entity?.size_category ?? '') : '';
  const crValues = npc.cr_values ?? [];
  const sizes = npc.size_categories ?? [];
  const showCr = npc.has_cr !== false;
  const showSize = sizes.length > 0;
  if (!showCr && !showSize) return null;
  return h('div', { class: 'entity-fields-npc', style: `display:${isPC ? 'none' : ''};` },
    h('div', { class: 'form-row' }, [
      showCr && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-cr' }, 'CR'),
        crValues.length
          ? h('select', { class: 'form-select', id: 'entity-cr' }, crValues.map(cr => h('option', { value: cr, selected: cr === currentCr }, cr)))
          : h('input', { type: 'text', class: 'form-input', id: 'entity-cr', value: currentCr }),
      ]),
      showSize && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'entity-size' }, 'Size'),
        h('select', { class: 'form-select', id: 'entity-size' },
          sizes.map(s => h('option', { value: s, selected: s === currentSize }, s))),
      ]),
    ]));
}

export function NPCMonsterDetails({ ui, entity, isPC, isEdit }) {
  const npc = ui.state.settings.systemConfig?.npc;
  if (!npc) return null;
  const val = (k) => isEdit && !isPC ? (entity[k] || '') : '';
  const num = (k) => isEdit && !isPC ? (entity[k] ?? 0) : 0;
  const field = (id, label, opts = {}) => h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: id }, label),
    h('input', { type: opts.type || 'text', class: 'form-input', id, min: opts.min, value: opts.num ? num(opts.key) : val(opts.key) }),
  ]);
  const typeChoices = npc.creature_types ?? [];
  return h('div', { class: 'entity-fields-npc', style: `display:${isPC ? 'none' : ''};` }, [
    h('div', { class: 'section-header' }, 'Monster Details'),
    h('div', { class: 'form-row' }, [
      npc.has_alignment !== false && field('npc-alignment', 'Alignment', { key: 'alignment' }),
      typeChoices.length
        ? h('div', { class: 'form-group' }, [
            h('label', { class: 'form-label', for: 'npc-creature-type' }, 'Type'),
            h('select', { class: 'form-select', id: 'npc-creature-type' },
              [''].concat(typeChoices).map((t) =>
                h('option', { value: t, selected: t === val('creature_type') }, t || '(none)'))),
          ])
        : field('npc-creature-type', 'Type', { key: 'creature_type' }),
    ]),
    field('npc-senses', 'Senses', { key: 'senses' }),
    field('npc-languages', 'Languages', { key: 'languages' }),
    h('div', { class: 'form-row' }, [
      field('npc-damage-resistances', 'Resistances', { key: 'damage_resistances' }),
      field('npc-damage-immunities', 'Immunities', { key: 'damage_immunities' }),
    ]),
    h('div', { class: 'form-row' }, [
      field('npc-condition-immunities', 'Condition Immunities', { key: 'condition_immunities' }),
      field('npc-legendary-count', 'Legendary Actions', { type: 'number', key: 'legendary_actions_count', num: true, min: 0 }),
    ]),
  ]);
}

function ActionFieldset({ action, onRemove }) {
  return h('fieldset', { style: 'border:0.5px solid var(--color-border-tertiary);border-radius:4px;padding:8px;margin-bottom:8px;' }, [
    h('legend', { class: 'form-label', style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;' }, [
      h('span', null, 'Action'),
      onRemove && h('button', {
        type: 'button',
        class: 'dbt dbt--sm dbt--ghost',
        'aria-label': `Remove action: ${action.name || '(unnamed)'}`,
        title: 'Remove this action',
        onClick: onRemove,
      }, 'Remove'),
    ]),
    h('input', { type: 'text', class: 'form-input action-name', placeholder: 'Name', value: action.name || '' }),
    h('input', { type: 'text', class: 'form-input action-desc', placeholder: 'Description', value: action.description || '', style: 'margin-top:8px;' }),
    h('div', { class: 'form-row', style: 'margin-top:8px;' }, [
      h('div', { class: 'form-group' }, h('input', { type: 'number', class: 'form-input action-attack', placeholder: '+Atk', value: action.attack_bonus || '' })),
      h('div', { class: 'form-group' }, h('input', { type: 'text', class: 'form-input action-damage', placeholder: 'Dmg', value: action.damage || '' })),
      h('div', { class: 'form-group' }, h('input', { type: 'text', class: 'form-input action-damage-type', placeholder: 'Type', value: action.damage_type || '' })),
    ]),
  ]);
}

/**
 * Authoring list for `entity.actions[]`. Used for both PCs and NPCs;
 * only the NPC-specific "Hidden from players" checkbox is gated on
 * isPC. Each row is an `ActionFieldset` (name, description, attack
 * bonus, damage, damage type) with a Remove button. The result is
 * read at form-submit time by `_parseActions(modal)` in entity/forms.js.
 */
export function NPCActions({ entity, isPC, isEdit }) {
  const seed = (isEdit && Array.isArray(entity?.actions)) ? entity.actions : [{}];
  const [actions, setActions] = useState(seed.map((a, i) => ({ ...a, _k: i })));
  const removeAt = (i) => setActions((arr) => arr.filter((_, j) => j !== i));
  return h('div', null, [
    h('div', { class: 'section-header' }, 'Actions'),
    h('div', { id: 'entity-actions-list' }, actions.map((a, i) => h(ActionFieldset, {
      key: a._k, action: a, onRemove: () => removeAt(i),
    }))),
    h('button', {
      type: 'button', class: 'dbt', id: 'add-action-btn', style: 'width:100%;margin-bottom:16px;',
      onClick: () => setActions((as) => [...as, { _k: Date.now() }]),
    }, '+ Add Action'),
    !isPC && h('div', { class: 'form-group' },
      h('label', { class: 'form-label' }, [
        h('input', { type: 'checkbox', id: 'entity-hidden', checked: isEdit && entity.is_hidden, style: 'margin-right:4px;' }),
        ' Hidden from players',
      ])),
  ]);
}
