/**
 * Spell-preview dispatcher - parallels item-card-sections.js.
 *
 * Returns HTML strings; the preview modal binds a single delegated
 * click handler that routes `data-spell-action` buttons through
 * `ui.castSpell` / damage roll / save announce.
 *
 * Ruleset-agnostic: every kind reads fields off the spell object;
 * no game-system hard-coded here.
 */

import { esc } from '../utils/component.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { dispatchSections } from './section-dispatcher.js';

function _ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function sectionSpellMeta({ spell }) {
  const parts = [];
  if (spell?.level === 0) parts.push('Cantrip');
  else if (typeof spell?.level === 'number') parts.push(`${_ordinal(spell.level)}-level`);
  if (spell?.school) parts.push(esc(String(spell.school)));
  const head = parts.join(' ');
  const time = spell?.casting_time ? ` · ${esc(String(spell.casting_time))}` : '';
  if (!head && !time) return '';
  return `<div class="spell-preview__meta">${head}${time}</div>`;
}

function sectionCastSpell({ spell }) {
  const slot = typeof spell?.level === 'number' && spell.level > 0
    ? ` (uses level ${spell.level} slot)`
    : '';
  return `<button type="button" class="dbt dbt--sm spell-preview__action"
    data-spell-action="cast" data-spell-id="${esc(String(spell?.id ?? ''))}"
    aria-label="Cast ${esc(String(spell?.name ?? 'spell'))}">🪄 Cast${slot}</button>`;
}

function sectionSpellDamageRoll({ spell }) {
  if (!spell?.damage) return '';
  const dtype = spell.damage_type ? ` ${esc(String(spell.damage_type))}` : '';
  return `<button type="button" class="dbt dbt--sm spell-preview__action"
    data-spell-action="damage" data-spell-id="${esc(String(spell?.id ?? ''))}"
    data-damage="${esc(String(spell.damage))}"
    aria-label="Roll ${esc(String(spell.damage))} damage">🎲 Damage ${esc(String(spell.damage))}${dtype}</button>`;
}

function sectionSpellSaveRoll({ spell }) {
  if (!spell?.save_ability) return '';
  const ability = String(spell.save_ability).toUpperCase();
  return `<button type="button" class="dbt dbt--sm spell-preview__action"
    data-spell-action="save" data-spell-id="${esc(String(spell?.id ?? ''))}"
    aria-label="Announce ${ability} save"> ${ability} Save</button>`;
}

function sectionDescription({ spell }) {
  if (!spell?.description) return '';
  return `<div class="spell-preview__desc">${renderMarkdown(String(spell.description))}</div>`;
}

function sectionHigherLevel({ spell }) {
  if (!spell?.higher_level) return '';
  return `<div class="spell-preview__higher"><b>At Higher Levels:</b> ${esc(String(spell.higher_level))}</div>`;
}

function sectionStatRow({ spell, config }) {
  const parts = [];
  for (const stat of config.stats ?? []) {
    const value = spell?.[stat.field];
    if (value === null || value === undefined || value === '') continue;
    const label = stat.label ? `${esc(stat.label)}: ` : '';
    parts.push(`<span>${label}${esc(String(value))}</span>`);
  }
  if (parts.length === 0) return '';
  return `<div class="spell-preview__stats row-lg muted-small">${parts.join('')}</div>`;
}

const KINDS = {
  spell_meta:        sectionSpellMeta,
  description:       sectionDescription,
  cast_spell:        sectionCastSpell,
  spell_damage_roll: sectionSpellDamageRoll,
  spell_save_roll:   sectionSpellSaveRoll,
  higher_level:      sectionHigherLevel,
  stat_row:          sectionStatRow,
};

export function renderSpellPreviewSections(spell, sections) {
  return dispatchSections(KINDS, sections, (config) => ({ spell, config })).join('');
}
