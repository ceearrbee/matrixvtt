/**
 * Icon picker UI smoke test. Stubs `fetch` to deliver a small manifest
 * and exercises search, category filter, theme toggle, selection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetIconManifestCache } from '../utils/builtin-icons.js';
import { showIconPicker } from '../ui/icon-picker/IconPickerModal.jsx';

const MANIFEST = {
  version: 1,
  themes: ['dark', 'light'],
  authors: ['lorc', 'delapouite'],
  categories: [
    { key: 'weapons', label: 'Weapons', count: 2 },
    { key: 'items', label: 'Items', count: 1 },
  ],
  icons: [
    { id: 'lorc/handcuffs', name: 'Handcuffs', author: 'lorc', tags: ['handcuffs', 'lorc'], categories: ['items'] },
    { id: 'lorc/broadsword', name: 'Broadsword', author: 'lorc', tags: ['broadsword', 'sword', 'lorc'], categories: ['weapons'] },
    { id: 'delapouite/scimitar', name: 'Scimitar', author: 'delapouite', tags: ['scimitar', 'sword', 'delapouite'], categories: ['weapons'] },
  ],
};

function tick() { return new Promise((r) => setTimeout(r, 0)); }
function flush() { return new Promise((r) => setTimeout(r, 20)); }

describe('IconPickerModal', () => {
  beforeEach(() => {
    _resetIconManifestCache();
    document.documentElement.setAttribute('data-theme', 'dark');
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(MANIFEST),
    }));
  });

  afterEach(() => {
    document.querySelectorAll('#icon-picker-modal').forEach((m) => m.remove());
    document.body.querySelectorAll('div').forEach((d) => {
      if (d.children.length === 0) d.remove();
    });
    delete global.fetch;
  });

  it('mounts the modal and loads the manifest', async () => {
    showIconPicker({ theme: 'dark', onSelect: () => {} });
    await flush();
    const overlay = document.querySelector('#icon-picker-modal');
    expect(overlay).toBeTruthy();
    const tiles = overlay.querySelectorAll('.icon-picker__tile');
    expect(tiles.length).toBe(3);
  });

  it('filters by search query', async () => {
    showIconPicker({ theme: 'dark', onSelect: () => {} });
    await flush();
    const search = document.querySelector('#icon-picker-search');
    search.value = 'sword';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    const tiles = document.querySelectorAll('.icon-picker__tile');
    expect(tiles.length).toBe(2);
  });

  it('filters by category chip', async () => {
    showIconPicker({ theme: 'dark', onSelect: () => {} });
    await flush();
    const chips = document.querySelectorAll('.icon-picker__chips .dbt');
    const itemsChip = Array.from(chips).find((b) => b.textContent.startsWith('Items'));
    itemsChip.click();
    await tick();
    const tiles = document.querySelectorAll('.icon-picker__tile');
    expect(tiles.length).toBe(1);
    expect(tiles[0].getAttribute('data-id')).toBe('lorc/handcuffs');
  });

  it('invokes onSelect with the resolved URL when a tile is clicked', async () => {
    const onSelect = vi.fn();
    showIconPicker({ theme: 'light', onSelect });
    await flush();
    const tile = document.querySelector('.icon-picker__tile[data-id="lorc/broadsword"]');
    tile.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [url, icon] = onSelect.mock.calls[0];
    expect(url).toMatch(/\/icons\/light\/lorc\/broadsword\.svg$/);
    expect(icon.id).toBe('lorc/broadsword');
    // Modal disposed
    expect(document.querySelector('#icon-picker-modal')).toBeNull();
  });

  it('does not call onSelect when closed via the close button', async () => {
    const onSelect = vi.fn();
    showIconPicker({ theme: 'dark', onSelect });
    await flush();
    const closeBtn = document.querySelector('button[aria-label="Close"]');
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.querySelector('#icon-picker-modal')).toBeNull();
  });

  it('shows an empty state when query has no matches', async () => {
    showIconPicker({ theme: 'dark', onSelect: () => {} });
    await flush();
    const search = document.querySelector('#icon-picker-search');
    search.value = 'zzznonexistent';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    const empty = document.querySelector('.icon-picker__empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('zzznonexistent');
  });
});
