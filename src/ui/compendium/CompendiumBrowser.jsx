/**
 * CompendiumBrowser - modal body for browsing SRD compendium entries
 * and adding them to the campaign. Pure presentation over the pure
 * helpers in browse-helpers.js and the per-kind flows in kinds.js;
 * the compendium payload arrives through the injected `load` so tests
 * and callers control the (lazy) data source.
 */

import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { COMPENDIUM_KINDS } from './kinds.js';
import { capResults } from './browse-helpers.js';
import { buildSearchIndex } from '../../content/compendium/search-index.js';

const RESULT_CAP = 50;

export function CompendiumBrowser({ ui, kind, load }) {
  const config = COMPENDIUM_KINDS[kind];
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [facetValue, setFacetValue] = useState('');

  useEffect(() => {
    let alive = true;
    load()
      .then((p) => { if (alive) setPayload(p); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  const facetOptions = useMemo(
    () => (payload ? config.facet.options(payload[config.dataKey].entries) : []),
    [payload],
  );

  if (error) {
    return h('div', { 'data-compendium-error': true, class: 'compendium-status' },
      'The compendium failed to load. Check your connection and reopen this dialog.');
  }
  if (!payload) {
    return h('div', { 'data-compendium-loading': true, class: 'compendium-status' },
      'Loading compendium…');
  }

  const { meta, entries } = payload[config.dataKey];

  const index = useMemo(
    () => buildSearchIndex(entries, { facetKey: config.facet.key }),
    [entries],
  );
  const filtered = index.query(query, facetValue);
  const { shown, hiddenCount } = capResults(filtered, RESULT_CAP);

  const addEntry = async (entry) => {
    const ok = await config.add(ui, entry);
    if (ok) ui._toast?.(`${entry.name} added`, 'success');
  };

  return h('div', { class: 'compendium-browser' }, [
    h('div', { class: 'compendium-browser__controls' }, [
      h('input', {
        id: 'compendium-search',
        type: 'search',
        class: 'form-input',
        placeholder: 'Search by name…',
        'aria-label': 'Search the compendium by name',
        value: query,
        onInput: (e) => setQuery(e.target.value),
      }),
      h('select', {
        id: 'compendium-facet',
        class: 'form-select',
        'aria-label': `Filter by ${config.facet.label}`,
        value: facetValue,
        onChange: (e) => setFacetValue(e.target.value),
      }, [
        h('option', { value: '' }, `All ${config.facet.label.toLowerCase()}s`),
        ...facetOptions.map((opt) =>
          h('option', { key: String(opt), value: String(opt) }, String(opt))),
      ]),
    ]),
    h('div', { class: 'compendium-browser__results', role: 'list' },
      shown.map((entry) => h('div', {
        key: entry.id,
        'data-compendium-row': entry.id,
        class: 'compendium-browser__row',
        role: 'listitem',
      }, [
        h('div', { class: 'compendium-browser__row-text' }, [
          h('span', { class: 'compendium-browser__name' }, entry.name),
          h('span', { class: 'compendium-browser__summary' }, config.summary(entry)),
        ]),
        h('button', {
          type: 'button',
          class: 'dbt',
          'aria-label': `Add ${entry.name} to the campaign`,
          onClick: () => addEntry(entry),
        }, 'Add'),
      ]))),
    hiddenCount > 0 && h('div', { 'data-compendium-more': true, class: 'compendium-browser__more' },
      `${hiddenCount} more, refine your search`),
    shown.length === 0 && h('div', { class: 'compendium-status' }, 'No entries match.'),
    h('div', { class: 'compendium-attribution' }, meta.attribution),
  ]);
}
