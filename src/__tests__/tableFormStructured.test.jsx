/**
 * TableFormModal - structured per-entry rows.
 *
 * Replaces the freeform textarea + `[[item:<id>]]` wikilink parsing
 * with a structured editor (Weight + Text + Linked item dropdown +
 * Remove button per entry, plus "+ Add entry"). State round-trips
 * through `entries: [{ weight, text, item_id? }]`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showTableForm } from '../ui/tables/TableFormModal.jsx';
import { EVENT_TYPES } from '../utils/constants.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi(tables = {}, items = {}) {
  const state = withFacade({
    isGM: () => true,
    tables: new Map(Object.entries(tables)),
    items: new Map(Object.entries(items)),
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  return { state, _toast: vi.fn(), _log: vi.fn() };
}

function entryRows() {
  return [...document.querySelectorAll('.table-entry')];
}

describe('TableFormModal - structured editor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens with one empty entry row when creating a new table', () => {
    showTableForm(makeUi());
    expect(entryRows()).toHaveLength(1);
    expect(document.querySelector('[data-table-entries]')).toBeTruthy();
    // The entry row uses the same grid column count, so the header
    // row has the same `display:grid` as the entries.
  });

  it('opens with one row per existing entry in edit mode', () => {
    const ui = makeUi(
      {
        'tbl-1': {
          name: 'Loot',
          entries: [
            { weight: 2, text: 'Boot' },
            { weight: 1, text: 'Cloak' },
            { weight: 3, text: 'Goblin Ear', item_id: 'itm-ear' },
          ],
        },
      },
      { 'itm-ear': { name: 'Goblin Ear' } }
    );
    showTableForm(ui, 'tbl-1');
    expect(entryRows()).toHaveLength(3);
  });

  it('"+ Add entry" appends a blank row', async () => {
    showTableForm(makeUi());
    document.querySelector('[data-add-entry]').click();
    await new Promise(r => setTimeout(r, 0));
    expect(entryRows()).toHaveLength(2);
  });

  it('saving serialises entries with item_id when an item is linked', async () => {
    const ui = makeUi({}, { 'itm-ear': { name: 'Goblin Ear' } });
    showTableForm(ui);
    document.getElementById('table-name').value = 'Loot';
    document.getElementById('table-name').dispatchEvent(new Event('input', { bubbles: true }));

    const row = entryRows()[0];
    const [weight, text] = row.querySelectorAll('input');
    weight.value = '2';
    weight.dispatchEvent(new Event('input', { bubbles: true }));
    text.value = 'Goblin Ear';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = row.querySelector('select');
    sel.value = 'itm-ear';
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 0));
    document.getElementById('table-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const tableCall = ui.state.sendStateEvent.mock.calls.find(c => c[0] === EVENT_TYPES.TABLE);
    expect(tableCall).toBeTruthy();
    expect(tableCall[2].entries).toEqual([{ weight: 2, text: 'Goblin Ear', item_id: 'itm-ear' }]);
  });

  it('clearing the linked item back to "- none -" drops item_id from the saved entry', async () => {
    const ui = makeUi(
      {
        'tbl-1': { name: 'Loot', entries: [{ weight: 1, text: 'Goblin Ear', item_id: 'itm-ear' }] },
      },
      { 'itm-ear': { name: 'Goblin Ear' } }
    );
    showTableForm(ui, 'tbl-1');

    const sel = entryRows()[0].querySelector('select');
    sel.value = '';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));

    document.getElementById('table-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const tableCall = ui.state.sendStateEvent.mock.calls.find(c => c[0] === EVENT_TYPES.TABLE);
    expect(tableCall[2].entries[0]).toEqual({ weight: 1, text: 'Goblin Ear' });
    expect(tableCall[2].entries[0].item_id).toBeUndefined();
  });

  it('removing a row drops it from the saved entries', async () => {
    const ui = makeUi({
      'tbl-1': {
        name: 'Loot',
        entries: [
          { weight: 1, text: 'A' },
          { weight: 1, text: 'B' },
        ],
      },
    });
    showTableForm(ui, 'tbl-1');

    // Click ✕ on the first row.
    const removeBtn = entryRows()[0].querySelector('button');
    removeBtn.click();
    await new Promise(r => setTimeout(r, 0));

    document.getElementById('table-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const tableCall = ui.state.sendStateEvent.mock.calls.find(c => c[0] === EVENT_TYPES.TABLE);
    expect(tableCall[2].entries).toEqual([{ weight: 1, text: 'B' }]);
  });
});
