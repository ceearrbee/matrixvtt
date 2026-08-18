/**
 * LogControls.jsx - filter/search popover for the chat log.
 *
 * Replaces the always-visible `.log-controls` strip with a single
 * icon-button trigger; clicking opens a popover that hosts filter
 * pills + search box + "load older" + clear. A badge on the trigger
 * surfaces when filter or search is non-default so users don't lose
 * track of an applied filter (resting log surface stays calm).
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const FILTERS = [
  ['all',    'All',    null],
  ['chat',   'Chat',   '💬'],
  ['dice',   'Dice',   '🎲'],
  ['combat', 'Combat', '⚔️'],
  ['map',    'Map',    '🗺️'],
];

function filterLabel(filter) {
  const entry = FILTERS.find(([k]) => k === filter);
  return entry ? entry[1] : 'All';
}

export function LogControls({
  search, filter,
  onSearchChange, onFilterChange,
  onLoadMore, canLoadMore, loading,
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on outside click / Escape so the popover behaves like a real
  // menu instead of a sticky panel.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isFiltered = filter !== 'all';
  const isSearching = !!search;
  const hasActive = isFiltered || isSearching;

  const triggerBadge = isFiltered
    ? (FILTERS.find(([k]) => k === filter)?.[2] || '•')
    : isSearching ? '🔍' : null;

  const clear = () => {
    onFilterChange('all');
    onSearchChange('');
  };

  return h('div', { class: 'log-controls' }, [
    h('button', {
      ref: triggerRef,
      type: 'button',
      class: `log-controls__trigger${hasActive ? ' log-controls__trigger--active' : ''}`,
      'aria-haspopup': 'true',
      'aria-expanded': String(open),
      'aria-label': hasActive
        ? `Open log filters (active: ${filterLabel(filter)}${isSearching ? `, search: ${search}` : ''})`
        : 'Open log filters',
      title: 'Filter and search log',
      onClick: () => setOpen((v) => !v),
    }, [
      h('span', { 'aria-hidden': 'true' }, '⋯'),
      triggerBadge && h('span', { class: 'log-controls__badge', 'aria-hidden': 'true' }, triggerBadge),
    ]),
    open && h('div', {
      ref: popoverRef,
      class: 'log-controls__popover',
      role: 'dialog',
      'aria-label': 'Filter log',
    }, [
      h('label', { for: 'log-search', class: 'log-controls__label' }, 'Search'),
      h('input', {
        type: 'search', id: 'log-search', class: 'log-controls__search',
        placeholder: 'Search log…', value: search, autocomplete: 'off',
        onInput: (e) => onSearchChange(e.target.value),
      }),
      h('div', { class: 'log-controls__label' }, 'Filter'),
      h('div', { class: 'log-controls__filters', role: 'group' },
        FILTERS.map(([k, label, glyph]) => h('button', {
          key: k,
          type: 'button',
          class: `dbt dbt--sm${filter === k ? ' dbt--active' : ''}`,
          'data-log-filter': k,
          'aria-pressed': String(filter === k),
          onClick: () => onFilterChange(k),
        }, glyph ? `${glyph} ${label}` : label)),
      ),
      h('div', { class: 'log-controls__actions' }, [
        canLoadMore && h('button', {
          type: 'button',
          class: 'dbt dbt--sm log-controls__load',
          disabled: loading,
          onClick: () => onLoadMore?.(),
        }, loading ? 'Loading…' : '⬆ Load older'),
        hasActive && h('button', {
          type: 'button',
          class: 'dbt dbt--sm log-controls__clear',
          onClick: clear,
        }, 'Clear'),
      ]),
    ]),
  ]);
}
