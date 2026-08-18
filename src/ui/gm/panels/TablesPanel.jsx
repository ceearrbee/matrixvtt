/**
 * TablesPanel - list of rollable tables with create/edit/roll/delete.
 * Rendered inside the GM sidebar tab.
 */
import { h } from 'preact';
import { tablesSignal } from '../../../state/signals.js';

function TableRow({ ui, id, table, isGM }) {
  const count = table.entries?.length ?? 0;
  const countLabel = `${count} ${count === 1 ? 'entry' : 'entries'}`;
  return h(
    'div',
    { class: 'table-row row-xs row--center', style: 'gap:6px;margin-bottom:var(--space-xs);' },
    [
      h('div', { class: 'table-row__meta', style: 'flex:1;min-width:0;' }, [
        h(
          'div',
          {
            class: 'table-row__name',
            style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;',
          },
          table.name || '(unnamed)'
        ),
        h('div', { class: 'table-row__count muted-small' }, countLabel),
      ]),
      h(
        'button',
        {
          class: 'dbt dbt--compact',
          'data-roll-table': id,
          'aria-label': `Roll on table ${table.name}`,
          title: `Roll on ${table.name}`,
          onClick: () => ui.rollTable(id),
        },
        '🎲'
      ),
      isGM &&
        h(
          'button',
          {
            class: 'dbt dbt--compact',
            'data-edit-table': id,
            'aria-label': `Edit table ${table.name}`,
            title: 'Edit table',
            onClick: () => ui.showTableForm(id),
          },
          '✏️'
        ),
      isGM &&
        h(
          'button',
          {
            class: 'dbt dbt--compact',
            'data-delete-table': id,
            style: 'color:var(--color-text-danger)',
            'aria-label': `Delete table ${table.name}`,
            title: 'Delete table',
            onClick: () => ui.deleteTable(id),
          },
          '🗑'
        ),
    ]
  );
}

/** @param {{ ui: any, gm?: any }} props */
export function TablesPanel(props) {
  const { ui } = props;
  tablesSignal.value;
  const isGM = ui.state.isGM();
  const tables = Array.from(ui.state.tables.entries());

  return h('div', { class: 'gm-panel gm-panel--tables', style: 'padding:12px;' }, [
    isGM &&
      h(
        'button',
        {
          class: 'dbt dbt--sm btn-primary',
          style: 'width:100%;margin-bottom:10px;',
          'aria-label': 'Add new rollable table',
          title: 'New table',
          onClick: () => ui.showTableForm(),
        },
        '+ New Table'
      ),
    tables.length === 0
      ? h(
          'div',
          { class: 'muted-small', style: 'text-align:center;margin-top:20px;' },
          'No tables yet'
        )
      : h(
          'div',
          null,
          tables.map(([id, t]) => h(TableRow, { key: id, ui, id, table: t, isGM }))
        ),
  ]);
}
