/**
 * Item card dispatcher - returns HTML strings (items-tab.js is template-string).
 */

import { esc } from '../utils/component.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { dispatchSections } from './section-dispatcher.js';

function sectionBadge({ item, config }) {
  const value = item?.[config.field];
  if (value === null || value === undefined || value === '') return '';
  const color = config.color_map?.[value] ?? 'var(--color-text-secondary)';
  return `<span class="item-card__badge" style="color:${esc(String(color))};">${esc(String(value))}</span>`;
}

function sectionAttackLine({ item }) {
  if (item?.attack_bonus === undefined || item?.attack_bonus === null) return '';
  const dmg = item.damage ? ` · ${esc(item.damage)}` : '';
  const type = item.damage_type ? ` ${esc(item.damage_type)}` : '';
  const sign = item.attack_bonus >= 0 ? '+' : '';
  return `<div class="item-card__attack">${sign}${item.attack_bonus} hit${dmg}${type}</div>`;
}

function sectionDescription({ item, config }) {
  const value = item?.[config.field ?? 'description'];
  if (!value) return '';
  return `<div class="item-card__desc">${renderMarkdown(String(value))}</div>`;
}

function sectionStatRow({ item, config }) {
  const parts = [];
  for (const stat of config.stats ?? []) {
    const value = item?.[stat.field];
    if (value === null || value === undefined || value === '') continue;
    const label = stat.label ? `${esc(stat.label)}: ` : '';
    const unit = stat.unit ? ` ${esc(stat.unit)}` : '';
    parts.push(`<span>${label}${esc(String(value))}${unit}</span>`);
  }
  if (parts.length === 0) return '';
  return `<div class="item-card__meta row-lg muted-small">${parts.join('')}</div>`;
}

function sectionAttackRoll({ item }) {
  if (item?.attack_bonus === undefined || item?.attack_bonus === null) return '';
  const sign = item.attack_bonus >= 0 ? '+' : '';
  return `<button type="button" class="dbt dbt--sm item-card__action"
    data-item-action="attack-roll" data-item-id="${esc(String(item.id ?? ''))}"
    aria-label="Roll attack with ${esc(String(item.name ?? 'item'))}">🎲 Attack ${sign}${item.attack_bonus}</button>`;
}

function sectionDamageRoll({ item }) {
  if (!item?.damage) return '';
  const dtype = item.damage_type ? ` ${esc(String(item.damage_type))}` : '';
  return `<button type="button" class="dbt dbt--sm item-card__action"
    data-item-action="damage-roll" data-item-id="${esc(String(item.id ?? ''))}" data-damage="${esc(String(item.damage))}"
    aria-label="Roll ${esc(String(item.damage))} damage">🎲 Damage ${esc(String(item.damage))}${dtype}</button>`;
}

function sectionUseConsumable({ item }) {
  if (!item?.consumable) return '';
  const qty = typeof item.quantity === 'number' ? ` (${item.quantity} left)` : '';
  return `<button type="button" class="dbt dbt--sm item-card__action"
    data-item-action="use-consumable" data-item-id="${esc(String(item.id ?? ''))}"
    aria-label="Use ${esc(String(item.name ?? 'consumable'))}">Use${qty}</button>`;
}

const KINDS = {
  badge:           sectionBadge,
  attack_line:     sectionAttackLine,
  description:     sectionDescription,
  stat_row:        sectionStatRow,
  attack_roll:     sectionAttackRoll,
  damage_roll:     sectionDamageRoll,
  use_consumable:  sectionUseConsumable,
};

export function renderItemCardSections(item, sections) {
  return dispatchSections(KINDS, sections, (config) => ({ item, config })).join('');
}

/**
 * Resolve which section list to use for a given item, honoring an
 * optional per-type override block:
 *
 *   ruleset.item_kinds[<type>].sections   // per-type, e.g. "note"
 *   ruleset.item_card.sections            // shared fallback
 *
 * The lookup is case-insensitive on `item.type`. An empty / missing
 * type falls through to the shared list, matching the form's
 * "weapon-shaped if blank" UX.
 *
 * Rulesets declare layouts per kind so a note and a sword stop sharing
 * one section list. The default list still applies for any type that
 * doesn't have a dedicated block, so existing rulesets keep working
 * unchanged.
 */
export function getItemSections(ruleset, item) {
  if (!ruleset) return [];
  const type = String(item?.type ?? '').trim().toLowerCase();
  const perType = type ? ruleset.item_kinds?.[type]?.sections : undefined;
  return perType ?? ruleset.item_card?.sections ?? [];
}
