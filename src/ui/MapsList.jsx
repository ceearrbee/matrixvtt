/**
 * MapsList - left-pane list of maps inside MapsPanel.
 */

import { h } from 'preact';
import { Card } from './Card.jsx';
import { EmptyState } from './EmptyState.jsx';
import { TrashIcon, CopyIcon } from './icons/index.jsx';
import { SaveToLibraryButton } from './library/SaveToLibraryButton.jsx';
import { LIBRARY_KIND } from '../utils/constants.js';

export function MapsList({ ui, maps, selectedId, activeId, isGM, onSelect, onOpen, onDuplicate, onDelete, onNew }) {
  return h('div', { id: 'maps-list-panel', style: 'flex:0 0 40%;border-right:1px solid var(--color-border);display:flex;flex-direction:column;' }, [
    h('div', { style: 'padding:16px;border-bottom:1px solid var(--color-border);' },
      h('h3', { style: 'margin:0;font-size:14px;font-weight:600;color:var(--color-text-secondary);' }, `Maps (${maps.length})`)),
    h('div', { style: 'flex:1;overflow-y:auto;padding:12px;' },
      maps.length === 0
        ? h(EmptyState, {
            message: isGM ? 'No maps yet.' : 'No maps yet. Ask your GM to add one.',
            cta: isGM ? { label: '+ New Map', onClick: onNew } : undefined,
          })
        : h('div', { id: 'maps-list', style: 'display:flex;flex-direction:column;gap:8px;' },
        maps.map(([id, cfg]) => h(Card, {
          key: id,
          class: `map-list-item${id === selectedId ? ' map-list-item--selected' : ''}${id === activeId ? ' map-list-item--active' : ''}`,
          ariaLabel: `Select map ${cfg.name || 'Untitled'}`,
          onActivate: () => onSelect(id),
          onDblActivate: () => onOpen(id),
          extraProps: { 'data-map-id': id },
        }, h('div', { class: 'map-list-item__header' }, [
          h('div', { class: 'map-list-item__info' }, [
            h('div', { class: 'map-list-item__name' }, cfg.name || 'Untitled'),
            h('div', { class: 'map-list-item__meta' }, `${cfg.width_cells}×${cfg.height_cells} · ${cfg.image_url ? '🖼️' : '🏁'}`),
            id === activeId && h('span', { class: 'map-active-badge' }, '✓ ACTIVE'),
          ]),
          isGM && h('div', { style: 'display:flex;flex-direction:column;gap:4px;' }, [
            h(SaveToLibraryButton, { ui, kind: LIBRARY_KIND.MAP, entity: { ...cfg, id }, compact: false }),
            id !== activeId && h('button', { class: 'dbt dbt--sm', title: 'Duplicate map', 'aria-label': 'Duplicate map', onClick: (e) => { e.stopPropagation(); onDuplicate(id); } }, h(CopyIcon, {})),
            id !== activeId && h('button', { class: 'dbt dbt--sm dbt--danger', title: 'Delete map', 'aria-label': 'Delete map', onClick: (e) => { e.stopPropagation(); onDelete(id); } }, h(TrashIcon, {})),
          ]),
        ]))))),
    isGM && h('div', { style: 'padding:12px;border-top:1px solid var(--color-border);display:flex;flex-direction:column;gap:6px;' }, [
      h('button', { class: 'dbt btn-primary', id: 'new-map-btn', style: 'width:100%;', onClick: onNew }, '+ New Map'),
      h('label', { class: 'dbt dbt--sm', style: 'width:100%;text-align:center;cursor:pointer;', title: 'Import Dungeondraft / Arkenforge Universal VTT (.dd2vtt / .uvtt / .json)' }, [
        '⇧ Import UVTT',
        h('input', {
          type: 'file',
          accept: '.dd2vtt,.uvtt,.json,application/json',
          style: 'display:none;',
          onChange: async (e) => {
            const file = e.target.files?.[0];
            if (file) await ui.importUvttFile?.(file);
            e.target.value = '';
          },
        }),
      ]),
    ]),
  ]);
}
