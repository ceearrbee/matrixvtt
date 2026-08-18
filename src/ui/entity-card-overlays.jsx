/**
 * entity-card-overlays.jsx - ruleset-driven status line for character
 * and NPC cards. Rulesets declare `character_card.overlays[]` with the
 * same vocabulary as `token.overlays[]` (resource_bar, pip_track,
 * badge); the card renders the DOM equivalent of what the map draws on
 * tokens. Unknown kinds silently skip.
 */
import { h } from 'preact';
import { getHPColor } from '../utils/ui-helpers.js';

export function pipStates(entity, config) {
  const raw = entity?.[config.field];
  const flat = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' ? Object.values(raw).flat() : [];
  const count = config.count ?? flat.length;
  return Array.from({ length: count }, (_, i) => !!flat[i]);
}

function ResourceBar({ entity, config }) {
  const cur = Number(entity?.[config.current_field] ?? 0);
  const max = Number(entity?.[config.max_field] ?? 0);
  if (!Number.isFinite(max) || max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  const label = config.label ?? '';
  return h('div', { class: 'card-overlay' }, [
    h('div', {
      class: 'hp-bar', role: 'meter', 'aria-label': label || 'Resource',
      'aria-valuenow': cur, 'aria-valuemin': 0, 'aria-valuemax': max,
    }, h('div', { class: 'hp-bar__track' },
        h('div', { class: 'hp-bar__fill', style: `width: ${pct}%; background: ${getHPColor(pct)};` }))),
    h('div', { class: 'char-card__hp-label' }, [
      label && `${label}: `,
      h('span', { class: 'hp-bar__value' }, `${cur} / ${max}`),
    ]),
  ]);
}

function PipTrack({ entity, config }) {
  const pips = pipStates(entity, config);
  if (pips.length === 0) return null;
  return h('div', { class: 'card-overlay card-overlay--pips' }, [
    config.label && h('span', { class: 'card-overlay__label' }, `${config.label}: `),
    h('span', { role: 'img', 'aria-label': `${config.label ?? 'Track'}: ${pips.filter(Boolean).length} of ${pips.length}` },
      pips.map((filled, i) => h('span', {
        key: i,
        class: `card-pip${filled ? ' card-pip--filled' : ''}`,
        'aria-hidden': 'true',
      }))),
  ]);
}

function Badge({ entity, config }) {
  const value = entity?.[config.field];
  if (!value) return null;
  return h('span', { class: 'card-overlay card-overlay--badge' }, `${config.prefix ?? ''}${value}`);
}

function TextLine({ entity, config }) {
  const raw = entity?.[config.field];
  let parts;
  if (typeof raw === 'string') {
    parts = [raw];
  } else if (Array.isArray(raw)) {
    parts = raw;
  } else if (raw && typeof raw === 'object') {
    parts = Object.entries(raw).map(([key, value]) => {
      if (!value) return '';
      const rating = config.with_attribute_ratings ? entity?.attributes?.[key] : undefined;
      return rating != null ? `${value} ${rating}` : value;
    });
  } else {
    parts = [];
  }
  const text = parts.filter(Boolean).join(' · ');
  if (!text) return null;
  return h('div', { class: 'card-overlay card-overlay--text' }, [
    config.label && h('span', { class: 'card-overlay__label' }, `${config.label}: `),
    text,
  ]);
}

const KINDS = { resource_bar: ResourceBar, pip_track: PipTrack, badge: Badge, text: TextLine };

export function CardOverlays({ entity, overlays }) {
  if (!Array.isArray(overlays)) return null;
  return h('div', { class: 'card-overlays' },
    overlays.map((config, i) => {
      const Kind = KINDS[config?.kind];
      return Kind ? h(Kind, { key: i, entity, config }) : null;
    }));
}
