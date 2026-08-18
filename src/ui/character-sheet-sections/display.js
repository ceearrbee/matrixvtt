/**
 * Display-only section primitives for the character/NPC sheet: simple
 * readouts and basic editable fields. The interactive narrative
 * primitives live in `./narrative.js`; the larger list/action surfaces
 * in `./lists.js`; the dispatcher in `../characterSheetSections.js`.
 */

import { h, Fragment } from 'preact';
import { getHPColor } from '../../utils/ui-helpers.js';
import { renderMarkdown } from '../../utils/renderMarkdown.js';
import { computeDerived } from '../../engine/computeDerived.js';
import { buildCharacterFormulaContext } from '../../engine/characterFormulaContext.js';
import { EmptyState } from '../EmptyState.jsx';
import { ENTITY_TYPES } from '../../utils/constants.js';
import { DynamicAttributes } from '../DynamicAttributes.jsx';

function resolveInventory(character, itemsMap) {
  const ids = character?.inventory_ids ?? [];
  const out = [];
  for (const id of ids) {
    const item = itemsMap?.get?.(id);
    if (item) out.push(item);
  }
  return out;
}

function resolveStatValue(ui, character, stat) {
  if (stat.formula) {
    const ruleset = ui.state.settings.systemConfig;
    // Rich ctx - attribute mods, derived.pb, cast.mod, proficient.<skill>
    // - so ruleset-level formulas like `passive_perception` or
    // `spell_save_dc` resolve without the stat_grid renderer caring how.
    const ctx = buildCharacterFormulaContext(ruleset, character, {
      inventory: resolveInventory(character, ui.state.items),
    });
    const v = computeDerived(ruleset, stat.formula, ctx);
    if (v !== null && v !== undefined) return v;
  }
  if (stat.field) {
    const v = character[stat.field];
    if (v !== null && v !== undefined) return v;
  }
  return '-';
}

/**
 * Notes sink - feeds rendered-markdown HTML for character notes. The
 * sole producer is `renderMarkdown(character.notes)`, which sanitises
 * to a known-safe HTML subset; no other caller is allowed.
 */
function TrustedMarkup({ html, class: cls }) {
  return h('div', {
    class: cls,
    dangerouslySetInnerHTML: { __html: html },
  });
}

export function ResourceTrack({ ui, character, config }) {
  const cur = character[config.current_field ?? 'hp_current'] ?? 0;
  const max = character[config.max_field ?? 'hp_max'] ?? 0;
  const canEdit = ui.state.canEditEntity(character);
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const label = config.label ?? 'HP';
  const id = config.id ?? 'hp';
  const kind = character.type === ENTITY_TYPES.NPC ? 'npc' : 'character';
  const adjust = (delta) => ui.adjustHP?.(character.id, delta, kind);
  const adjustBtn = (delta, text) => h('button', {
    class: 'dbt dbt--compact',
    'aria-label': `${delta > 0 ? 'Increase' : 'Reduce'} ${label} by ${Math.abs(delta)}`,
    title: `${delta > 0 ? '+' : ''}${delta} ${label}`,
    onClick: () => adjust(delta),
  }, text);
  return h('div', {
    class: 'hp-bar', role: 'meter', 'aria-label': label,
    title: `${label}: ${cur} / ${max}`,
    'aria-valuenow': cur, 'aria-valuemin': 0, 'aria-valuemax': max,
  }, [
    h('div', { class: 'hp-bar__header' }, [
      h('span', { class: 'hp-bar__label' }, label),
      canEdit
        ? h(Fragment, null, [
            h('input', {
              type: 'number', class: 'hp-edit-input',
              key: `${id}-${character.id}-${cur}`,
              defaultValue: cur, min: 0, max,
              'aria-label': `Current ${label}`,
              onBlur: (e) => ui.setHP?.(character.id, e.target.value, kind),
              onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); },
            }),
            ` / ${max}`,
            h('div', { class: 'row-xs push-right' }, [
              adjustBtn(-1, '−1'), adjustBtn(1, '+1'), adjustBtn(5, '+5'),
            ]),
          ])
        : h('span', { class: 'hp-bar__value' }, `${cur} / ${max}`),
    ]),
    h('div', { class: 'hp-bar__track' },
      h('div', { class: 'hp-bar__fill', style: `width: ${pct}%; background: ${getHPColor(pct)};` })),
  ]);
}

export function StatGrid({ ui, character, config }) {
  const stats = config.stats ?? [];
  return h('div', { class: 'stats-grid stats-grid--3col' },
    stats.map((s, i) => h('div', { key: i, class: 'ab', title: s.label }, [
      h('div', { class: 'ab__label' }, s.label),
      h('div', { class: 'ab__value' }, resolveStatValue(ui, character, s)),
    ])),
  );
}

export function Attributes({ ui, character }) {
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Attributes'),
    h(DynamicAttributes, { ui, attributes: character.attributes || {}, character }),
  ]);
}

export function Saves({ ui, character }) {
  const saves = ui._deriveCharacterSaves?.(character);
  if (!saves || !Object.keys(saves).length) {
    return h(Fragment, null, [
      h('div', { class: 'section-header' }, 'Saving Throws'),
      h('div', { class: 'entity-subtitle entity-subtitle--none' },
        'None defined for this character.'),
    ]);
  }
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Saving Throws'),
    h('div', {
      class: 'save-grid',
    }, Object.entries(saves).map(([label, bonus]) => h('div', {
        key: label,
        class: 'skill-row skill-row--roll',
        title: `Roll ${label} saving throw`,
        onClick: () => ui.rollSkillCheck?.(label, bonus),
      }, [
        h('span', { class: 'skill-row__name' }, label),
        h('span', { class: 'skill-row__bonus' }, `${bonus >= 0 ? '+' : ''}${bonus}`),
      ]))),
  ]);
}

export function Conditions({ character }) {
  const conds = Array.isArray(character.conditions) ? character.conditions : [];
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Conditions'),
    h('div', { class: 'entity-subtitle entity-subtitle--none' },
      conds.length ? conds.join(', ') : 'None active'),
  ]);
}

export function Defenses({ character }) {
  // Ruleset-agnostic: any combination of damage_resistances,
  // damage_immunities, damage_vulnerabilities, condition_immunities
  // can be present. Each field is a free-form string ("fire", "cold;
  // non-magical weapons", "frightened, paralyzed"). Hide the section
  // entirely if none are set so a stat block with no defenses
  // doesn't leave a stray header.
  const fields = [
    ['Resistances',       character.damage_resistances],
    ['Immunities',        character.damage_immunities],
    ['Vulnerabilities',   character.damage_vulnerabilities],
    ['Conditions Immune', character.condition_immunities],
  ].filter(([, v]) => typeof v === 'string' && v.trim().length > 0);
  if (fields.length === 0) return null;
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Defenses'),
    h('div', { class: 'defenses' },
      fields.map(([label, value]) => h('div', { key: label, class: 'defenses__row' }, [
        h('span', { class: 'defenses__label' }, `${label}: `),
        h('span', { class: 'defenses__value' }, value),
      ]))),
  ]);
}

export function Notes({ character }) {
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Notes'),
    character.notes
      ? h(TrustedMarkup, {
          class: 'handout-content char-notes',
          html: renderMarkdown(character.notes),
        })
      : h(EmptyState, { message: 'No notes yet.' }),
  ]);
}

export function StressBoxes({ ui, character }) {
  const boxes = ui.state.settings.systemConfig?.harm_model?.boxes ?? [];
  const checked = character.stress ?? boxes.map(() => false);
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Stress'),
    h('div', {
      class: 'row-sm stress-row',
    }, boxes.map((capacity, i) => h('label', {
        key: i,
        class: 'stack stress-box',
      }, [
        h('input', {
          type: 'checkbox',
          checked: checked[i] === true,
          onChange: (e) => {
            const next = boxes.map((_, j) => checked[j] === true);
            next[i] = e.target.checked;
            ui.patchEntity?.(character.id, { stress: next });
          },
        }),
        h('span', { class: 'muted-small' }, capacity),
      ]))),
  ]);
}

export function Aspects({ character }) {
  const aspects = Array.isArray(character.aspects) ? character.aspects : [];
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Aspects'),
    aspects.length === 0
      ? h('div', { class: 'entity-subtitle entity-subtitle--none' }, 'None')
      : h('ul', { class: 'char-sheet__bullet-list' },
          aspects.map((a, i) => h('li', { key: i }, a))),
  ]);
}

export function Wounds({ character }) {
  const wounds = Array.isArray(character.wounds) ? character.wounds : [];
  return h(Fragment, null, [
    h('div', { class: 'section-header' }, 'Wounds'),
    wounds.length === 0
      ? h('div', { class: 'entity-subtitle entity-subtitle--none' }, 'None')
      : h('ul', { class: 'char-sheet__bullet-list' },
          wounds.map((w, i) => h('li', { key: i }, `${w.tier} (${w.amount})`))),
  ]);
}

/**
 * `personality` - generic free-form identity block. Reads optional
 * string fields off the character; renders one labeled line each.
 * Editable in the entity form; read-only here.
 *
 *   { kind: 'personality', label?: string, fields?: [{ field, label }, …] }
 *
 * Without `fields`, defaults to the D&D 5e shape (alignment / background
 * / ideals / bonds / flaws). Pass an explicit list to compose for
 * non-D&D systems.
 */
export function Personality({ character, config }) {
  const fields = Array.isArray(config?.fields) ? config.fields : [
    { field: 'alignment',  label: 'Alignment'  },
    { field: 'background', label: 'Background' },
    { field: 'ideals',     label: 'Ideals'     },
    { field: 'bonds',      label: 'Bonds'      },
    { field: 'flaws',      label: 'Flaws'      },
  ];
  const present = fields.filter((f) => {
    const v = character?.[f.field];
    return typeof v === 'string' && v.trim().length > 0;
  });
  if (present.length === 0) return null;
  return h('section', { class: 'narrative-section', 'aria-label': config?.label ?? 'Personality' }, [
    h('div', { class: 'section-header' }, config?.label ?? 'Personality'),
    h('div', { class: 'narrative-slots' }, present.map((f) => h('div', {
      key: f.field,
      class: 'narrative-slots__row',
    }, [
      h('span', { class: 'narrative-slots__label' }, f.label),
      h('span', { class: 'narrative-list__text' }, character[f.field]),
    ]))),
  ]);
}
