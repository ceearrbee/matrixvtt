/**
 * TablesPanel - GM-only sub-panel that lists rollable tables and exposes
 * create/edit/roll/delete actions. Mirrors the Handouts list/edit pattern.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { tablesSignal } from '../state/signals.js';
import { TablesPanel } from '../ui/gm/panels/TablesPanel.jsx';

function makeUi(tablesMap, isGM = true) {
  return {
    state: { isGM: () => isGM, tables: tablesMap },
    showTableForm: vi.fn(),
    rollTable: vi.fn(),
    deleteTable: vi.fn(),
  };
}

describe('<TablesPanel>', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    tablesSignal.value = new Map();
  });

  it('renders one row per table with name and entry count', () => {
    const tables = new Map([
      [
        't1',
        {
          name: 'Rumors',
          entries: [
            { weight: 1, text: 'a' },
            { weight: 1, text: 'b' },
          ],
        },
      ],
      ['t2', { name: 'Loot', entries: [{ weight: 1, text: 'c' }] }],
    ]);
    tablesSignal.value = tables;
    render(h(TablesPanel, { ui: makeUi(tables) }), host);
    expect(host.textContent).toContain('Rumors');
    expect(host.textContent).toContain('Loot');
    expect(host.textContent).toMatch(/2 entries/);
    expect(host.textContent).toMatch(/1 entry/);
  });

  it('shows empty state when no tables exist', () => {
    tablesSignal.value = new Map();
    render(h(TablesPanel, { ui: makeUi(new Map()) }), host);
    expect(host.textContent).toMatch(/no tables/i);
  });

  it('"+ New Table" button calls ui.showTableForm() with no id', () => {
    const ui = makeUi(new Map());
    tablesSignal.value = new Map();
    render(h(TablesPanel, { ui }), host);
    const btn = [...host.querySelectorAll('button')].find(b => /new table/i.test(b.textContent));
    btn?.click();
    expect(ui.showTableForm).toHaveBeenCalledWith();
  });

  it('edit button calls ui.showTableForm(id)', () => {
    const tables = new Map([['t1', { name: 'X', entries: [{ weight: 1, text: 'a' }] }]]);
    tablesSignal.value = tables;
    const ui = makeUi(tables);
    render(h(TablesPanel, { ui }), host);
    const btn = host.querySelector('[data-edit-table="t1"]');
    btn?.click();
    expect(ui.showTableForm).toHaveBeenCalledWith('t1');
  });

  it('roll button calls ui.rollTable(id)', () => {
    const tables = new Map([['t1', { name: 'X', entries: [{ weight: 1, text: 'a' }] }]]);
    tablesSignal.value = tables;
    const ui = makeUi(tables);
    render(h(TablesPanel, { ui }), host);
    const btn = host.querySelector('[data-roll-table="t1"]');
    btn?.click();
    expect(ui.rollTable).toHaveBeenCalledWith('t1');
  });

  it('delete button calls ui.deleteTable(id)', () => {
    const tables = new Map([['t1', { name: 'X', entries: [{ weight: 1, text: 'a' }] }]]);
    tablesSignal.value = tables;
    const ui = makeUi(tables);
    render(h(TablesPanel, { ui }), host);
    const btn = host.querySelector('[data-delete-table="t1"]');
    btn?.click();
    expect(ui.deleteTable).toHaveBeenCalledWith('t1');
  });

  it('GM-only action buttons hidden when not GM', () => {
    const tables = new Map([['t1', { name: 'X', entries: [{ weight: 1, text: 'a' }] }]]);
    tablesSignal.value = tables;
    render(h(TablesPanel, { ui: makeUi(tables, false) }), host);
    expect(host.querySelector('[data-edit-table]')).toBeNull();
    expect(host.querySelector('[data-delete-table]')).toBeNull();
    // Roll remains available; players may roll on shared tables.
    expect(host.querySelector('[data-roll-table]')).toBeTruthy();
  });
});
