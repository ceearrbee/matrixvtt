/**
 * LibraryBrowser master/detail body: lists entries from the selected
 * source, filters by kind and name, previews the selected entry, inserts
 * through the per-kind flow, and offers rename/delete only on writable
 * sources.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';

vi.mock('../ui/library/kinds.js', () => ({
  LIBRARY_KINDS: {
    npc: { noun: 'NPC', summary: () => 'a creature', insert: vi.fn(async () => true) },
    item: { noun: 'item', summary: () => 'gear', insert: vi.fn(async () => true) },
  },
}));

import { LibraryBrowser } from '../ui/library/LibraryBrowser.jsx';
import { LIBRARY_KINDS } from '../ui/library/kinds.js';

const ENTRIES = [
  { id: 'lib-1', kind: 'npc', name: 'Goblin', data: { hp: 7 }, updated_at: 0 },
  { id: 'lib-2', kind: 'item', name: 'Rope', data: {}, updated_at: 0 },
];

function makePersonalSource(entries = ENTRIES) {
  const state = [...entries];
  return {
    id: 'personal',
    label: 'My library',
    writable: true,
    listEntries: vi.fn(async (kind = null) =>
      kind ? state.filter((e) => e.kind === kind) : state),
    deleteEntry: vi.fn(async () => {}),
    renameEntry: vi.fn(async () => {}),
  };
}

function makeUi() {
  return { _toast: vi.fn(), widgetManager: { homeserver: 'https://hs' } };
}

afterEach(() => { cleanup(); vi.mocked(LIBRARY_KINDS.npc.insert).mockClear(); });

async function selectRow(container, id) {
  await waitFor(() => expect(container.querySelector(`[data-library-row="${id}"]`)).not.toBeNull());
  fireEvent.click(container.querySelector(`[data-library-row="${id}"]`));
  await waitFor(() => expect(container.querySelector('[data-library-preview]')).not.toBeNull());
}

describe('LibraryBrowser', () => {
  it('lists entries from the default source', async () => {
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [makePersonalSource()] }));
    await waitFor(() => expect(container.querySelectorAll('[data-library-row]').length).toBe(2));
  });

  it('previews the selected entry', async () => {
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [makePersonalSource()] }));
    await selectRow(container, 'lib-1');
    expect(container.querySelector('[data-library-preview="lib-1"]').textContent).toContain('Goblin');
  });

  it('filters by kind', async () => {
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [makePersonalSource()] }));
    await waitFor(() => expect(container.querySelector('[data-library-row]')).not.toBeNull());
    const select = container.querySelector('#library-kind');
    select.value = 'item';
    fireEvent.change(select);
    await waitFor(() => {
      const rows = container.querySelectorAll('[data-library-row]');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Rope');
    });
  });

  it('filters by name search', async () => {
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [makePersonalSource()] }));
    await waitFor(() => expect(container.querySelector('[data-library-row]')).not.toBeNull());
    const input = container.querySelector('#library-search');
    input.value = 'goblin';
    fireEvent.input(input, { target: input });
    const rows = container.querySelectorAll('[data-library-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Goblin');
  });

  it('inserts the selected entry through the per-kind flow', async () => {
    const ui = makeUi();
    const { container } = render(h(LibraryBrowser, { ui, sources: [makePersonalSource()] }));
    await selectRow(container, 'lib-1');
    fireEvent.click(container.querySelector('[data-library-insert="lib-1"]'));
    await waitFor(() => expect(LIBRARY_KINDS.npc.insert).toHaveBeenCalled());
    expect(vi.mocked(LIBRARY_KINDS.npc.insert).mock.calls[0][1]).toMatchObject({ id: 'lib-1' });
  });

  it('offers delete and rename on a writable source', async () => {
    const src = makePersonalSource();
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [src] }));
    await selectRow(container, 'lib-1');
    expect(container.querySelector('[data-library-delete="lib-1"]')).not.toBeNull();
    expect(container.querySelector('[data-library-rename="lib-1"]')).not.toBeNull();
  });

  it('renames through an inline field', async () => {
    const src = makePersonalSource();
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [src] }));
    await selectRow(container, 'lib-1');
    fireEvent.click(container.querySelector('[data-library-rename="lib-1"]'));
    const input = await waitFor(() => container.querySelector('[data-library-rename-input="lib-1"]'));
    input.value = 'Hobgoblin';
    fireEvent.input(input, { target: input });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(src.renameEntry).toHaveBeenCalledWith('lib-1', 'Hobgoblin'));
  });

  it('hides delete/rename on a read-only source', async () => {
    const src = { id: 'community', label: 'Community', writable: false, listEntries: async () => ENTRIES };
    const { container } = render(h(LibraryBrowser, { ui: makeUi(), sources: [src] }));
    await selectRow(container, 'lib-1');
    expect(container.querySelector('[data-library-delete]')).toBeNull();
    expect(container.querySelector('[data-library-rename]')).toBeNull();
    expect(container.querySelector('[data-library-insert]')).not.toBeNull();
  });
});
