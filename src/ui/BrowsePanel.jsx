/**
 * BrowsePanel.jsx - rpglog-style log-browse hub.
 *
 * First cut surfaces two sub-tabs that are pure read-only projections
 * over `ui.activityLog`:
 *
 *   Find   - substring search across entry.text
 *   Rolls  - dice entries only (icon === '🎲')
 *
 * The remaining rpglog tabs (TOC / Pins / Mentions / NPCs / Filter)
 * need infrastructure MatrixVTT doesn't yet expose; they land in
 * follow-up passes once the underlying engine surfaces exist.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { logVersionSignal } from '../state/ui-signals.js';

const TABS = /** @type {const} */ ([
  { id: 'find',  label: 'Find',  title: 'Substring search across the chat log' },
  { id: 'rolls', label: 'Rolls', title: 'Recent dice rolls' },
]);

function FindView({ activityLog }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q
    ? activityLog.filter((e) => (e?.text || '').toLowerCase().includes(q))
    : [];
  return h('div', { class: 'browse-panel__view', 'data-browse-panel': 'find' }, [
    h('label', { for: 'browse-find-input', class: 'sr-only', key: 'lbl' },
      'Search the chat log'),
    h('input', {
      key: 'in',
      id: 'browse-find-input',
      type: 'search',
      class: 'browse-panel__input',
      placeholder: 'Find in this game…',
      'aria-label': 'Find in this game',
      'data-browse-find-input': '',
      value: query,
      onInput: (e) => setQuery(e.currentTarget.value),
    }),
    h(ResultList, { key: 'rl', items: results, empty: !!q && results.length === 0 }),
  ]);
}

function RollsView({ activityLog }) {
  const rolls = activityLog.filter((e) => e?.icon === '🎲');
  return h('div', { class: 'browse-panel__view', 'data-browse-panel': 'rolls' },
    h(ResultList, { items: rolls, empty: rolls.length === 0 }),
  );
}

function ResultList({ items, empty }) {
  if (empty) {
    return h('div', {
      class: 'browse-panel__empty',
      'data-browse-empty': '',
    }, 'Nothing to show yet.');
  }
  return h('ul', { class: 'browse-panel__results', role: 'list' },
    items.map((e, i) => h('li', {
      key: i,
      class: 'browse-panel__result',
      'data-browse-result': '',
      // entry.text is already escaped by the log pipeline (same path
      // LogPanel relies on for chat rendering).
      dangerouslySetInnerHTML: { __html: e?.text || '' },
    })),
  );
}

/**
 * @param {{ ui: any }} props
 */
export function BrowsePanel({ ui }) {
  // Subscribe so the views rerender as the log grows.
  logVersionSignal.value;

  const [tab, setTab] = useState('find');
  const activityLog = Array.isArray(ui?.activityLog) ? ui.activityLog : [];

  return h('div', { class: 'browse-panel', 'data-browse-panel-root': '' }, [
    h('div', {
      class: 'browse-panel__tabs',
      role: 'tablist',
      'aria-label': 'Browse the log',
      key: 't',
    }, TABS.map((t) => h('button', {
      key: t.id,
      type: 'button',
      role: 'tab',
      class: `browse-panel__tab${tab === t.id ? ' browse-panel__tab--active' : ''}`,
      'data-browse-tab': t.id,
      'aria-selected': String(tab === t.id),
      title: t.title,
      onClick: () => setTab(t.id),
    }, t.label))),
    tab === 'find' && h(FindView, { activityLog, key: 'fv' }),
    tab === 'rolls' && h(RollsView, { activityLog, key: 'rv' }),
  ]);
}
