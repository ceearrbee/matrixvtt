/**
 * LibraryBrowser - master/detail modal body for the content library.
 * The left pane filters and lists entries from the selected source; the
 * right pane previews the selected entry and exposes the CRUD actions
 * (insert into the campaign, rename, delete). Sources are injected so
 * tests control the data.
 */

import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { LIBRARY_KINDS } from './kinds.js';
import { LibraryPreview } from './LibraryPreview.jsx';
import { filterEntries } from '../../library/sources.js';
import { confirm } from '../confirm-dialogs.jsx';
import { LIBRARY_KIND } from '../../utils/constants.js';

const KIND_LABELS = {
  [LIBRARY_KIND.CHARACTER]: 'Characters',
  [LIBRARY_KIND.NPC]: 'NPCs',
  [LIBRARY_KIND.ITEM]: 'Items',
  [LIBRARY_KIND.SPELL]: 'Spells',
  [LIBRARY_KIND.MAP]: 'Maps',
  [LIBRARY_KIND.RULESET]: 'Rulesets',
};

const KIND_BADGE = {
  [LIBRARY_KIND.CHARACTER]: 'PC',
  [LIBRARY_KIND.NPC]: 'NPC',
  [LIBRARY_KIND.ITEM]: 'Item',
  [LIBRARY_KIND.SPELL]: 'Spell',
  [LIBRARY_KIND.MAP]: 'Map',
  [LIBRARY_KIND.RULESET]: 'Rules',
};

export function LibraryBrowser({ ui, sources }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const source = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? sources[0],
    [sourceId, sources],
  );

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setError(null);
    Promise.resolve(source.listEntries(kind || null))
      .then((list) => { if (alive) setEntries(list); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [source, kind, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);
  const visible = entries ? filterEntries(entries, query) : [];
  const selected = visible.find((e) => e.id === selectedId) ?? null;

  useEffect(() => { setRenaming(false); }, [selectedId, sourceId]);

  const insert = async (entry) => {
    const config = LIBRARY_KINDS[entry.kind];
    if (!config) { ui._toast?.(`Unsupported entry type: ${entry.kind}`, 'error'); return; }
    const ok = await config.insert(ui, entry);
    if (ok) ui._toast?.(`${entry.name} added to the campaign`, 'success');
  };

  const remove = (entry) => {
    confirm(`Delete "${entry.name}" from your library?`, async () => {
      await source.deleteEntry(entry.id);
      ui._toast?.(`${entry.name} removed`, 'success');
      setSelectedId(null);
      refresh();
    }, { confirmText: 'Delete', confirmClass: 'danger' });
  };

  const commitRename = async (entry, name) => {
    setRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === entry.name) return;
    await source.renameEntry(entry.id, trimmed);
    refresh();
  };

  return h('div', { class: 'library-browser' }, [
    h('div', { class: 'library-browser__list' }, [
      h('div', { class: 'library-browser__controls' }, [
        h('select', {
          id: 'library-source', class: 'form-select', 'aria-label': 'Library source',
          value: sourceId, onChange: (e) => { setSourceId(e.target.value); setSelectedId(null); },
        }, sources.map((s) => h('option', { key: s.id, value: s.id }, s.label))),
        h('select', {
          id: 'library-kind', class: 'form-select', 'aria-label': 'Filter by kind',
          value: kind, onChange: (e) => { setKind(e.target.value); setSelectedId(null); },
        }, [
          h('option', { value: '' }, 'All kinds'),
          ...Object.entries(KIND_LABELS).map(([k, label]) =>
            h('option', { key: k, value: k }, label)),
        ]),
      ]),
      h('input', {
        id: 'library-search', type: 'search', class: 'form-input',
        placeholder: 'Search by name…', 'aria-label': 'Search the library by name',
        value: query, onInput: (e) => setQuery(e.target.value),
      }),
      error && h('div', { 'data-library-error': true, class: 'library-browser__status' },
        'The library failed to load. Check your connection and reopen this dialog.'),
      !entries && !error && h('div', { 'data-library-loading': true, class: 'library-browser__status' },
        'Loading library…'),
      entries && h('div', { class: 'library-browser__rows', role: 'listbox', 'aria-label': 'Library entries' },
        visible.map((entry) => h('button', {
          key: entry.id, type: 'button', role: 'option',
          'data-library-row': entry.id,
          'aria-selected': entry.id === selectedId ? 'true' : 'false',
          class: `library-browser__row${entry.id === selectedId ? ' library-browser__row--active' : ''}`,
          onClick: () => setSelectedId(entry.id),
        }, [
          h('span', { class: 'library-browser__row-kind' }, KIND_BADGE[entry.kind] ?? entry.kind),
          h('span', { class: 'library-browser__row-name' }, entry.name),
        ]))),
      entries && visible.length === 0 && h('div', { class: 'library-browser__status' },
        source.writable
          ? 'Your library is empty. Use "Save to library" on a sheet, item, map, or ruleset.'
          : 'No entries match.'),
    ]),
    h('div', { class: 'library-browser__detail' }, selected
      ? [
          h(LibraryPreview, { ui, entry: selected, sourceLabel: source.label }),
          h('div', { class: 'library-browser__actions' }, renaming
            ? [h(RenameField, {
                entry: selected,
                onCommit: commitRename,
                onCancel: () => setRenaming(false),
              })]
            : [
                h('button', {
                  type: 'button', class: 'dbt btn-primary', 'data-library-insert': selected.id,
                  onClick: () => insert(selected),
                }, 'Insert into campaign'),
                source.writable && h('button', {
                  type: 'button', class: 'dbt', 'data-library-rename': selected.id,
                  onClick: () => setRenaming(true),
                }, 'Rename'),
                source.writable && h('button', {
                  type: 'button', class: 'dbt danger', 'data-library-delete': selected.id,
                  onClick: () => remove(selected),
                }, 'Delete'),
              ]),
        ]
      : h('div', { class: 'library-browser__placeholder' },
          entries && visible.length > 0 ? 'Select an entry to preview it.' : 'Nothing to preview yet.')),
  ]);
}

function RenameField({ entry, onCommit, onCancel }) {
  const [value, setValue] = useState(entry.name);
  return h('form', {
    class: 'library-browser__rename',
    onSubmit: (e) => { e.preventDefault(); onCommit(entry, value); },
  }, [
    h('input', {
      type: 'text', class: 'form-input', 'data-library-rename-input': entry.id,
      'aria-label': 'New name', value, autofocus: true,
      onInput: (e) => setValue(e.target.value),
    }),
    h('button', { type: 'submit', class: 'dbt btn-primary' }, 'Save'),
    h('button', { type: 'button', class: 'dbt', onClick: onCancel }, 'Cancel'),
  ]);
}
