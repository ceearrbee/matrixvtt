/**
 * Spells.jsx - spellbook tab. Renders spell slots, grouped spell cards by
 * level, and long-rest/add-spell controls.
 */

import { h } from 'preact';
import { Card } from './Card.jsx';
import { EditIcon, TrashIcon } from './icons/index.jsx';
import { spellsSignal, charactersSignal } from '../state/signals.js';
import { selectedCharacterIdSignal, selectedTokenSignal } from '../state/ui-signals.js';
import { getConcentratingSpell } from './spells-tab.js';
import { TabToolbar, SrdButton } from './TabToolbar.jsx';
import {
  getSpellSchoolIcon,
  getSpellLevelLabel,
  getSpellGroupKey,
  getSpellSlotLevels,
} from './spells-ruleset.js';
import { SaveToLibraryButton } from './library/SaveToLibraryButton.jsx';
import { LIBRARY_KIND } from '../utils/constants.js';

function SpellSlotRow({ ui, lvl, slots, canEdit }) {
  const { total = 0, used = 0 } = slots;
  const pips = Array.from({ length: total }, (_, i) => {
    const filled = i < used;
    const label = filled
      ? `Expended slot ${i + 1} of ${total} at level ${lvl}. Click to recover.`
      : `Available slot ${i + 1} of ${total} at level ${lvl}. Click to expend.`;
    return h('button', {
      key: i,
      class: `spell-slot-pip${filled ? ' spell-slot-pip--used' : ''}`,
      'aria-label': label,
      disabled: !canEdit,
      'aria-disabled': !canEdit ? 'true' : undefined,
      onClick: canEdit ? () => ui.toggleSpellSlotPip(lvl, i, used, total) : undefined,
    });
  });
  return h('div', { class: 'spell-slot-row' }, [
    h('span', { class: 'spell-slot-row__label' }, `Lv ${lvl}`),
    h('span', { class: 'spell-slot-row__pips', role: 'group', 'aria-label': `Level ${lvl} spell slots` }, pips),
    h('span', { class: 'spell-slot-row__count' }, `${used}/${total}`),
  ]);
}

function SpellSlots({ ui, spellSlots, canEdit }) {
  const ruleset = ui.state.settings?.systemConfig;
  const allowed = new Set(getSpellSlotLevels(ruleset));
  const levels = Object.keys(spellSlots).map(Number)
    .filter(l => allowed.size === 0 ? (l >= 1 && l <= 9) : allowed.has(l))
    .sort((a, b) => a - b);
  if (!levels.length) return null;
  return h('div', { style: 'display:contents' }, [
    h('div', { class: 'section-header', style: 'margin:8px 10px 4px;' }, 'Spell Slots'),
    h('div', { class: 'spell-slots-grid' },
      levels.map(lvl => h(SpellSlotRow, { key: lvl, ui, lvl, slots: spellSlots[String(lvl)] ?? {}, canEdit }))),
  ]);
}

function SpellCard({ ui, spell, spellId, casterId, concentratingId, canEdit, canPrepare }) {
  const isConcentrating = concentratingId === spellId;
  const ruleset = ui.state.settings?.systemConfig;
  const schoolIcon = getSpellSchoolIcon(ruleset, spell.school);
  const isPrepared = spell.level === 0 || spell.prepared;
  // Card click anywhere (except the inner buttons) opens the preview
  // popup. The header tags + chips stay visible inline so the user can
  // see concentration / range / casting time at a glance without
  // opening anything.
  // Top row: name + actions (prepare / edit / delete / library). School,
  // casting time, range, and concentration/ritual/cantrip status drop to a
  // wrapping tags row below so the name is never truncated in the rail.
  const actions = [
    spell.level !== 0 && canPrepare && h('button', {
      class: 'dbt dbt--compact spell-card__prep-btn',
      'aria-label': `${isPrepared ? 'Unprepare' : 'Prepare'} ${spell.name}`,
      title: isPrepared ? 'Unprepare spell' : 'Prepare spell',
      'aria-pressed': String(isPrepared),
      onClick: (e) => { e.stopPropagation(); ui.toggleSpellPrepared(spellId); },
    }, isPrepared ? '★' : '☆'),
    canEdit && h('button', {
      class: 'dbt dbt--compact', 'aria-label': `Edit ${spell.name}`, title: 'Edit spell',
      onClick: (e) => { e.stopPropagation(); ui.showSpellForm(spellId); },
    }, h(EditIcon, {})),
    canEdit && h('button', {
      class: 'dbt dbt--compact', 'aria-label': `Delete ${spell.name}`, title: 'Delete spell',
      style: 'color: var(--color-text-danger);',
      onClick: (e) => { e.stopPropagation(); ui.deleteSpell(spellId); },
    }, h(TrashIcon, {})),
    canEdit && h(SaveToLibraryButton, { ui, kind: LIBRARY_KIND.SPELL, entity: spell }),
  ].filter(Boolean);

  const tags = [
    spell.school && h('span', { class: 'spell-card__tag' }, `${schoolIcon} ${spell.school}`),
    spell.casting_time && h('span', { class: 'spell-card__tag' }, spell.casting_time),
    spell.range && h('span', { class: 'spell-card__tag' }, spell.range),
    spell.concentration && h('span', { class: 'spell-card__tag spell-card__tag--concentration', title: 'Requires concentration' }, 'Concentration'),
    spell.ritual && h('span', { class: 'spell-card__tag spell-card__tag--ritual', title: 'Can be cast as a ritual' }, 'Ritual'),
    spell.level === 0 && h('span', { class: 'spell-card__tag spell-card__tag--cantrip' }, 'Cantrip'),
  ].filter(Boolean);

  return h(Card, {
    class: `spell-card${isPrepared ? ' spell-card--prepared' : ''}${isConcentrating ? ' spell-card--concentrating' : ''}`,
    onActivate: () => ui.showSpellPreview?.(spellId, casterId),
    ariaLabel: `Open ${spell.name} preview`,
  }, [
    h('div', { class: 'spell-card__top' }, [
      spell.image_url && h('img', {
        src: spell.image_url, alt: '', loading: 'lazy', class: 'spell-card__icon',
      }),
      h('span', { class: 'spell-card__name' }, spell.name),
      actions.length > 0 && h('div', { class: 'spell-card__actions' }, actions),
    ].filter(Boolean)),
    tags.length > 0 && h('div', { class: 'spell-card__tags' }, tags),
  ]);
}

function GroupedSpells({ ui, character, concentratingId, canEdit, canPrepare }) {
  const ruleset = ui.state.settings?.systemConfig;
  const byKey = {};
  for (const spellId of (character.spell_ids ?? [])) {
    const spell = ui.state.spells.get(spellId);
    if (!spell) continue;
    const key = getSpellGroupKey(ruleset, spell);
    (byKey[key] ??= []).push({ id: spellId, spell });
  }
  // Sort numeric keys numerically; string keys alphabetically
  const entries = Object.entries(byKey);
  const allNumeric = entries.every(([k]) => !Number.isNaN(Number(k)));
  const groups = allNumeric
    ? entries.sort(([a], [b]) => +a - +b)
    : entries.sort(([a], [b]) => String(a).localeCompare(String(b)));
  return h('div', { style: 'display:contents' },
    groups.map(([key, group]) => h('div', { key, class: 'spell-level-group' }, [
      h('div', { class: 'section-header' },
        allNumeric ? getSpellLevelLabel(ruleset, +key) : String(key)),
      ...group.map(({ id, spell }) => h(SpellCard, { key: id, ui, spell, spellId: id, casterId: character.id, concentratingId, canEdit, canPrepare })),
    ])));
}

export function Spells({ ui }) {
  spellsSignal.value; charactersSignal.value;
  selectedCharacterIdSignal.value; selectedTokenSignal.value;
  const character = ui.state.getCurrentCharacter();
  if (!character) {
    return h('div', { class: 'empty-state' }, 'No character selected');
  }

  const canEdit = ui.state.canEditEntity(character);
  // Player-only sheet actions: expending slots, preparing spells, taking
  // a long rest. GMs author content (Add/Edit/Delete) but don't drive
  // the player's resource pool.
  const canPlayerEdit = canEdit && !ui.state.isGM();
  const spells = ui.state.getCurrentSpells();
  const spellSlots = character.spell_slots ?? {};
  const hasSpellSystem = ui.state.settings.systemConfig?.hasSpellSystem !== false;
  const concentratingEntry = getConcentratingSpell(character, ui.state.spells);
  const concentratingId = concentratingEntry?.id ?? null;

  return h('div', { class: 'spells-tab-wrapper' }, [
    h(TabToolbar, { title: 'Spellbook' }, [
      canEdit && h('button', {
        class: 'dbt dbt--sm btn-primary',
        'aria-label': 'Add new spell to spellbook', title: 'Add spell',
        onClick: () => ui.showSpellForm(null),
      }, '+ Add Spell'),
      canEdit && h(SrdButton, { ui, kind: 'spell' }),
      canPlayerEdit && h('button', {
        class: 'dbt dbt--sm', title: 'Restore HP and all spell slots', 'aria-label': 'Take long rest',
        onClick: () => ui.applyLongRest(),
      }, '😴 Long Rest'),
    ]),
    hasSpellSystem && h(SpellSlots, { ui, spellSlots, canEdit: canPlayerEdit }),
    spells.length === 0
      ? h('div', { class: 'empty-state' },
          canEdit ? 'No spells in this spellbook. Use + Add Spell to create one.' : 'No spells in this spellbook.')
      : h(GroupedSpells, { ui, character, concentratingId, canEdit, canPrepare: canPlayerEdit }),
  ]);
}
