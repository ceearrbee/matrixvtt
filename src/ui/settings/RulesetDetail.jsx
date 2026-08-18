/**
 * RulesetDetail - a complete, human-readable view of a ruleset preset so
 * a GM can inspect everything a system defines before switching to it.
 *
 * Every top-level section of the ruleset renders as a collapsible group;
 * inside, values render generically: string/number as text, arrays of
 * primitives as chips, arrays of objects as a list, objects as key/value
 * rows, and anything deeper than a few levels as pretty-printed JSON so
 * nothing is ever hidden from view.
 */
import { h } from 'preact';

const MAX_DEPTH = 4;

// Sections shown first (the rest follow in declaration order).
const PRIORITY = [
  'attributes', 'skills', 'saves', 'conditions', 'damage_types',
  'spell_schools', 'spellcasting', 'dice', 'rolls', 'formulas',
  'initiative', 'combat', 'item_kinds', 'currency', 'progression',
];

function humanize(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function RulesetValue({ value, depth = 0 }) {
  if (value === null || value === undefined || value === '') {
    return h('span', { class: 'rs-muted' }, 'none');
  }
  if (typeof value !== 'object') {
    return h('span', { class: 'rs-scalar' }, String(value));
  }
  if (depth >= MAX_DEPTH) {
    return h('pre', { class: 'rs-json' }, JSON.stringify(value, null, 2));
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return h('span', { class: 'rs-muted' }, 'none');
    if (value.every((v) => v === null || typeof v !== 'object')) {
      return h('div', { class: 'rs-chips' }, value.map((v, i) => h('span', { key: i, class: 'rs-chip' }, String(v))));
    }
    return h('ul', { class: 'rs-list' },
      value.map((v, i) => h('li', { key: i }, h(RulesetValue, { value: v, depth: depth + 1 }))));
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return h('span', { class: 'rs-muted' }, 'none');
  return h('dl', { class: 'rs-kv' },
    entries.flatMap(([k, v]) => [
      h('dt', { key: `${k}-t` }, humanize(k)),
      h('dd', { key: `${k}-d` }, h(RulesetValue, { value: v, depth: depth + 1 })),
    ]));
}

export function RulesetDetail({ preset }) {
  const keys = Object.keys(preset || {}).filter((k) => k !== 'meta');
  keys.sort((a, b) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  if (keys.length === 0) return null;
  return h('div', { class: 'rs-detail' },
    keys.map((k) => h('details', { key: k, class: 'rs-section', 'data-ruleset-detail': k }, [
      h('summary', { class: 'rs-section__head' }, humanize(k)),
      h('div', { class: 'rs-section__body' }, h(RulesetValue, { value: preset[k] })),
    ])));
}
